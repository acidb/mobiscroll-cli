const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const spawn = require('child_process').spawn;
const axios = require('axios');
const chalk = require('chalk');

// Browser sign-in, using npm's web login protocol on the Mobiscroll registry:
// POST /-/v1/login gives a link to approve on mobiscroll.com and a link to poll; polling answers
// 202 (with Retry-After) until the person approves, then 200 with the token. The token is never printed.
//
// --no-wait (for agents that only see the output once a command ends): the sign-in is started and kept in
// ~/.mobiscroll/cli.json, and the CLI stops. The next sign-in picks it up instead of starting a new one.

const stateDir = path.join(os.homedir(), '.mobiscroll');
const stateFile = path.join(stateDir, 'cli.json');
const maxWaitMs = 11 * 60 * 1000; // the ticket lives 10 minutes on the server
const pendingMs = 10 * 60 * 1000;
const defaultRetryMs = 2000;
const maxNetworkRetries = 5;

function readState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch (err) {
    return {};
  }
}

function writeState(state) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  } catch (err) {
    // Not fatal: the machine id is just new next time, and a --no-wait sign-in has to be started again
  }
}

/**
 * A random id kept in ~/.mobiscroll/cli.json. A new sign-in from the same machine cancels the previous token.
 */
function getMachineId() {
  const state = readState();
  if (!state.machineId) {
    state.machineId = crypto.randomBytes(16).toString('hex'); // not randomUUID: the CLI supports Node 11+
    writeState(state);
  }
  return state.machineId;
}

/**
 * The sign-in a --no-wait run left behind, if it is for the same registry and has not expired.
 */
function readPending(options) {
  const pending = readState().pending;
  if (
    !pending ||
    pending.registryUrl !== options.registryUrl ||
    !(pending.expiresAt > Date.now())
  ) {
    return null;
  }
  return pending;
}

function savePending(pending) {
  const state = readState();
  state.pending = pending;
  writeState(state);
}

function clearPending() {
  const state = readState();
  if (state.pending) {
    delete state.pending;
    writeState(state);
  }
}

function openBrowser(url) {
  if (!/^https?:\/\/[^\s"'`&^%|<>]+$/.test(url)) {
    return;
  }
  // Detached: with --no-wait the CLI exits right away, and on Windows that would also end a child still starting the browser
  const options = { detached: true, stdio: 'ignore' };
  const child =
    process.platform === 'win32'
      ? spawn('cmd.exe', ['/c', `start "" "${url}"`], Object.assign({ windowsVerbatimArguments: true }, options))
      : spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], options);
  child.on('error', () => {
    // If no browser can be opened, the printed link is enough
  });
  child.unref();
}

/**
 * The website's npm access tokens page, on the same site as the approve link (the registry's webUrl: prod, staging or a
 * local website). Undefined if the link isn't a URL.
 */
function tokensUrlFrom(loginUrl) {
  try {
    return new URL(loginUrl).origin + '/account/tokens';
  } catch (err) {
    return undefined;
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Prints the approve link and the code. A person always approves the sign-in on the website; the text says so.
 * @param {object} signIn { loginUrl, deviceUrl, code }
 * @param {{ askFirst: boolean, opening: boolean, resumed: boolean }} how askFirst: a person in a terminal, who
 * presses Enter to open the browser; opening: the CLI opens the browser now (no terminal, --yes or --no-wait);
 * resumed: the sign-in a --no-wait run started, still waiting
 */
function printSignIn(signIn, how) {
  let title;
  if (how.askFirst) {
    title = 'Sign in to Mobiscroll: approve this sign-in in your browser.';
  } else if (how.resumed) {
    title = 'This sign-in is still waiting for a person to approve it:';
  } else if (how.opening) {
    title = 'A person must approve this sign-in. Opening the approve page in the browser:';
  } else {
    title = 'A person must approve this sign-in. Open this link to approve it:';
  }
  const code = signIn.code ? chalk.bold(signIn.code) : '';
  const lines = [
    '',
    chalk.bold.cyan(title),
    '',
    '  ' + signIn.loginUrl,
    '',
    code ? `Check that the page shows the code ${code}, then click Approve.` : 'Click Approve on that page.',
  ];
  const device = signIn.deviceUrl && code ? `open ${signIn.deviceUrl} on any device and type the code.` : '';
  if (how.askFirst || !how.opening) {
    if (device) {
      lines.push('Or ' + device);
    }
  } else {
    lines.push('No browser window? Open the link above' + (device ? ', or ' + device : '.'));
  }
  if (!how.askFirst) {
    lines.push('AI agents: show this link and code to the user and let them approve. Never approve it yourself.');
  }
  console.log(lines.join('\n'));
}

/**
 * Opens the browser when the person presses Enter, while the sign-in is polled. Approving through /device
 * without pressing Enter works too.
 * @returns {function} stops listening, so the next prompt gets the terminal
 */
function openOnEnter(url, input) {
  function onData() {
    openBrowser(url);
  }
  input.once('data', onData);
  input.resume();
  return () => {
    input.removeListener('data', onData);
    input.pause();
  };
}

/**
 * Signs in through the browser.
 * @param {{ registryUrl: string, proxy: object|undefined, openBrowser: boolean, cliVersion: string, noWait: boolean,
 *   askFirst: boolean, input: object|undefined }} options
 * noWait: start the sign-in (or check the pending one) and return { pending: true } instead of waiting for the approval;
 * askFirst: a person in a terminal: print the link and open the browser only when they press Enter (input, default
 * process.stdin). Otherwise (agents, --yes) the browser opens right away, with a text saying a person must approve.
 * @returns {Promise<{ token: string, username: string, tokensUrl: string|undefined } | { pending: true }>}
 */
function webLogin(options) {
  const requestBase = {
    proxy: options.proxy,
    headers: { 'User-Agent': 'mobiscroll-cli/' + options.cliVersion },
    validateStatus: () => true,
  };

  function check(doneUrl) {
    return axios(Object.assign({}, requestBase, { method: 'get', url: doneUrl }));
  }

  function result(done, loginUrl) {
    if (done.status === 200 && done.data && done.data.token) {
      return { token: done.data.token, username: done.data.username || '', tokensUrl: tokensUrlFrom(loginUrl) };
    }
    if (done.status === 403) {
      throw new Error('The sign-in was denied on the website.');
    }
    throw new Error((done.data && done.data.error) || `The sign-in failed (status ${done.status}).`);
  }

  const askFirst = !!(options.askFirst && options.openBrowser && !options.noWait);

  // Prints the sign-in; opens the browser now, or on Enter. Returns the function that stops listening for Enter.
  function announce(signIn, resumed) {
    const opening = !!options.openBrowser && !askFirst && !resumed;
    printSignIn(signIn, { askFirst: askFirst, opening: opening, resumed: resumed });
    if (opening) {
      openBrowser(signIn.loginUrl);
    }
    if (askFirst) {
      console.log('\nPress Enter to open the link in your browser. Waiting for the approval...');
      return openOnEnter(signIn.loginUrl, options.input || process.stdin);
    }
    if (!options.noWait) {
      console.log('Waiting for the approval...');
    }
    return () => {};
  }

  function waitAndStop(doneUrl, deadline, loginUrl, stop) {
    return waitForApproval(doneUrl, deadline, loginUrl).then(
      (signedIn) => {
        stop();
        return signedIn;
      },
      (err) => {
        stop();
        throw err;
      },
    );
  }

  function waitForApproval(doneUrl, deadline, loginUrl) {
    let networkErrors = 0;

    function poll() {
      if (Date.now() > deadline) {
        return Promise.reject(new Error('The sign-in expired. Run the command again.'));
      }
      return check(doneUrl).then(
        (done) => {
          networkErrors = 0;
          if (done.status === 202) {
            const retryAfter = parseInt(done.headers && done.headers['retry-after'], 10);
            return wait(retryAfter > 0 ? retryAfter * 1000 : defaultRetryMs).then(poll);
          }
          return result(done, loginUrl);
        },
        (err) => {
          // Network hiccup while waiting: try again a few times
          if (++networkErrors > maxNetworkRetries) {
            throw err;
          }
          return wait(defaultRetryMs).then(poll);
        },
      );
    }

    return poll();
  }

  function start() {
    return axios(
      Object.assign({}, requestBase, {
        method: 'post',
        url: options.registryUrl + '/-/v1/login',
        data: { hostname: os.hostname(), machineId: getMachineId() },
      }),
    ).then((resp) => {
      if (resp.status === 429) {
        throw new Error('Too many sign-ins were started from this network. Wait a few minutes and try again.');
      }
      if (resp.status !== 200 || !resp.data || !resp.data.loginUrl || !resp.data.doneUrl) {
        throw new Error(`The registry did not start the sign-in (status ${resp.status}).`);
      }

      const signIn = {
        registryUrl: options.registryUrl,
        loginUrl: resp.data.loginUrl,
        doneUrl: resp.data.doneUrl,
        deviceUrl: resp.data.deviceUrl,
        code: resp.data.code,
        expiresAt: Date.now() + pendingMs,
      };
      const stop = announce(signIn, false);
      if (options.noWait) {
        savePending(signIn);
        return { pending: true };
      }
      return waitAndStop(signIn.doneUrl, Date.now() + maxWaitMs, signIn.loginUrl, stop);
    });
  }

  const pending = readPending(options);
  if (!pending) {
    return start();
  }

  // A --no-wait run started this sign-in: collect it, keep waiting for it, or start a new one if it is over
  return check(pending.doneUrl).then((done) => {
    if (done.status === 202) {
      // Not opened again: the run that started it did that. A person in a terminal can still press Enter.
      const stop = announce(pending, true);
      if (options.noWait) {
        return { pending: true };
      }
      return waitAndStop(pending.doneUrl, pending.expiresAt + 60 * 1000, pending.loginUrl, stop).then(
        (signedIn) => {
          clearPending();
          return signedIn;
        },
        (err) => {
          clearPending();
          throw err;
        },
      );
    }
    clearPending();
    if (done.status === 200) {
      return result(done, pending.loginUrl);
    }
    // Denied, expired or already used: start a new one
    console.log(`The previous sign-in can't be used (${(done.data && done.data.error) || 'status ' + done.status}). Starting a new one.`);
    return start();
  });
}

module.exports = {
  webLogin,
  getMachineId,
};
