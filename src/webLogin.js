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
 * The sign-in a --no-wait run left behind, if it is for the same registry and --team setting and has not expired.
 */
function readPending(options) {
  const pending = readState().pending;
  if (
    !pending ||
    pending.registryUrl !== options.registryUrl ||
    pending.team !== !!options.team ||
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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printSignIn(signIn, team) {
  console.log(
    '\n' +
      chalk.bold.cyan('Sign in to Mobiscroll in your browser:') +
      '\n\n  ' +
      signIn.loginUrl +
      '\n\n' +
      (signIn.code ? `Check that the page shows the code ${chalk.bold(signIn.code)}, then approve.` : 'Approve the sign-in on that page.') +
      (team ? ' Pick the team npm user on the page.' : '') +
      (signIn.deviceUrl && signIn.code ? `\nOr open ${signIn.deviceUrl} on any device and type the code ${chalk.bold(signIn.code)}.` : ''),
  );
}

/**
 * Signs in through the browser.
 * @param {{ registryUrl: string, proxy: object|undefined, team: boolean, openBrowser: boolean, cliVersion: string, noWait: boolean }} options
 * noWait: start the sign-in (or check the pending one) and return { pending: true } instead of waiting for the approval
 * @returns {Promise<{ token: string, username: string } | { pending: true }>}
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

  function result(done) {
    if (done.status === 200 && done.data && done.data.token) {
      return { token: done.data.token, username: done.data.username || '' };
    }
    if (done.status === 403) {
      throw new Error('The sign-in was denied on the website.');
    }
    throw new Error((done.data && done.data.error) || `The sign-in failed (status ${done.status}).`);
  }

  function waitForApproval(doneUrl, deadline) {
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
          return result(done);
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
        data: { hostname: os.hostname(), machineId: getMachineId(), team: !!options.team },
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
        team: !!options.team,
        loginUrl: resp.data.loginUrl,
        doneUrl: resp.data.doneUrl,
        deviceUrl: resp.data.deviceUrl,
        code: resp.data.code,
        expiresAt: Date.now() + pendingMs,
      };
      printSignIn(signIn, options.team);
      if (options.openBrowser) {
        openBrowser(signIn.loginUrl);
      }
      if (options.noWait) {
        savePending(signIn);
        return { pending: true };
      }
      console.log('Waiting for the approval...');
      return waitForApproval(signIn.doneUrl, Date.now() + maxWaitMs);
    });
  }

  const pending = readPending(options);
  if (!pending) {
    return start();
  }

  // A --no-wait run started this sign-in: collect it, keep waiting for it, or start a new one if it is over
  return check(pending.doneUrl).then((done) => {
    if (done.status === 202) {
      printSignIn(pending, pending.team);
      if (options.noWait) {
        return { pending: true };
      }
      console.log('Waiting for the approval...');
      return waitForApproval(pending.doneUrl, pending.expiresAt + 60 * 1000).then(
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
      return result(done);
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
