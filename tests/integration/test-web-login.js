/**
 * Tests for the browser sign-in (src/webLogin.js), reading the npm token (src/token.js),
 * the licence check through the registry (getApiKey) and the logout token cancel.
 * Network, shell and the home folder are stubbed.
 *
 * Run with: node tests/integration/test-web-login.js
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ── Temporary home folder (machine id, user-level .npmrc) ──────────────────
const realHome = os.homedir();
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mbsc-cli-weblogin-'));
const home = path.join(tmpRoot, 'home');
fs.mkdirSync(home);
process.env.HOME = home;
process.env.USERPROFILE = home;
delete process.env.NPM_CONFIG_USERCONFIG;

// ── Stub child_process (must be done before any require of utils) ──────────
const cp = require('child_process');
const executed = [];
cp.exec = (cmd, cb) => {
  executed.push(cmd);
  cb(null, '', '');
};
cp.spawn = (cmd, args) => {
  executed.push([cmd].concat(args || []).join(' '));
  return { on: () => {}, unref: () => {} };
};
cp.execSync = (cmd) => {
  if (cmd === 'yarn -v') throw new Error('yarn not present in test harness');
  return Buffer.from('');
};

// ── Stub axios: answers come from a queue, requests are recorded ───────────
const requests = [];
let answers = [];
const axiosPath = require.resolve('axios');
require.cache[axiosPath] = {
  id: axiosPath,
  filename: axiosPath,
  loaded: true,
  exports: Object.assign(
    (opts) => {
      requests.push(opts);
      const next = answers.shift();
      if (!next) {
        return Promise.reject(new Error('No stubbed answer for ' + (opts.method || 'get') + ' ' + opts.url));
      }
      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
    },
    { defaults: { headers: {} } },
  ),
};

// Polling waits Retry-After seconds: run timers immediately
global.setTimeout = (fn) => {
  fn();
  return 0;
};

const webLogin = require('../../src/webLogin.js');
const npmToken = require('../../src/token.js');
const utils = require('../../src/utils.js');

// Keep the printed sign-in text out of the test output, but let the summary through
const log = console.log;
const printed = [];
console.log = (...args) => printed.push(args.join(' '));

let passed = 0;
let failed = 0;

// The --no-wait sign-in kept in ~/.mobiscroll/cli.json
const stateFile = path.join(home, '.mobiscroll', 'cli.json');
function readStateFile() {
  return fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {};
}
function pendingState() {
  return readStateFile().pending;
}
function writePending(fields) {
  const state = readStateFile();
  state.pending = Object.assign(
    {
      registryUrl: 'https://npm.mobiscroll.com',
      loginUrl: 'https://mobiscroll.com/cli/approve?id=kept',
      doneUrl: 'https://npm.mobiscroll.com/-/v1/done/kept',
      code: 'KEPT-KEPT',
      expiresAt: Date.now() + 60000,
    },
    fields,
  );
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(state));
}
function clearPendingState() {
  const state = readStateFile();
  delete state.pending;
  fs.writeFileSync(stateFile, JSON.stringify(state));
}

function reset() {
  requests.length = 0;
  executed.length = 0;
  printed.length = 0;
  answers = [];
}

const cases = [
  {
    name: 'browser sign-in: 202 until approved, then the token',
    run: () => {
      answers = [
        { status: 200, data: { loginUrl: 'https://mobiscroll.com/cli/approve/abc', doneUrl: 'https://npm.mobiscroll.com/-/v1/done/xyz', code: 'WDJB-MJHT' } },
        { status: 202, headers: { 'retry-after': '2' }, data: {} },
        { status: 202, headers: { 'retry-after': '2' }, data: {} },
        { status: 200, data: { token: 'TOKEN-VALUE', username: 'anna@acme.com' } },
      ];
      return webLogin
        .webLogin({ registryUrl: 'https://npm.mobiscroll.com', team: true, openBrowser: true, cliVersion: '9.9.9' })
        .then((result) => {
          assert.strictEqual(result.token, 'TOKEN-VALUE');
          assert.strictEqual(result.username, 'anna@acme.com');
          assert.strictEqual(requests[0].method, 'post');
          assert.strictEqual(requests[0].url, 'https://npm.mobiscroll.com/-/v1/login');
          assert.strictEqual(requests[0].data.team, true);
          assert.ok(requests[0].data.machineId, 'machine id sent');
          assert.strictEqual(requests.length, 4, 'polled until 200');
          assert.ok(printed.join('\n').indexOf('WDJB-MJHT') !== -1, 'code printed');
          assert.ok(printed.join('\n').indexOf('TOKEN-VALUE') === -1, 'token never printed');
          assert.ok(executed.some((cmd) => cmd.indexOf('https://mobiscroll.com/cli/approve/abc') !== -1), 'browser opened');
        });
    },
  },
  {
    name: 'browser sign-in: the machine id is kept between sign-ins',
    run: () => {
      const first = webLogin.getMachineId();
      assert.strictEqual(webLogin.getMachineId(), first);
      assert.ok(fs.existsSync(path.join(home, '.mobiscroll', 'cli.json')));
      return Promise.resolve();
    },
  },
  {
    name: 'browser sign-in: denied on the website',
    run: () => {
      answers = [
        { status: 200, data: { loginUrl: 'https://mobiscroll.com/cli/approve/a', doneUrl: 'https://npm.mobiscroll.com/-/v1/done/b', code: 'BBBB-CCCC' } },
        { status: 403, data: { error: 'The sign-in was denied.' } },
      ];
      return webLogin.webLogin({ registryUrl: 'https://npm.mobiscroll.com', openBrowser: false, cliVersion: '9.9.9' }).then(
        () => assert.fail('should be rejected'),
        (err) => {
          assert.ok(/denied/.test(err.message));
          assert.strictEqual(executed.length, 0, 'no browser opened');
        },
      );
    },
  },
  {
    name: 'browser sign-in: expired',
    run: () => {
      answers = [
        { status: 200, data: { loginUrl: 'https://mobiscroll.com/cli/approve/a', doneUrl: 'https://npm.mobiscroll.com/-/v1/done/b' } },
        { status: 410, data: { error: 'The sign-in expired. Start it again.' } },
      ];
      return webLogin.webLogin({ registryUrl: 'https://npm.mobiscroll.com', cliVersion: '9.9.9' }).then(
        () => assert.fail('should be rejected'),
        (err) => assert.ok(/expired/.test(err.message)),
      );
    },
  },
  {
    name: 'browser sign-in: a network error while polling is retried',
    run: () => {
      answers = [
        { status: 200, data: { loginUrl: 'https://mobiscroll.com/cli/approve/a', doneUrl: 'https://npm.mobiscroll.com/-/v1/done/b' } },
        new Error('ECONNRESET'),
        { status: 200, data: { token: 'T2', username: 'x' } },
      ];
      return webLogin.webLogin({ registryUrl: 'https://npm.mobiscroll.com', cliVersion: '9.9.9' }).then((result) => {
        assert.strictEqual(result.token, 'T2');
      });
    },
  },
  {
    name: '--no-wait: prints the link, code and /device address, keeps the sign-in, does not poll',
    run: () => {
      answers = [
        {
          status: 200,
          data: {
            loginUrl: 'https://mobiscroll.com/cli/approve?id=nw',
            doneUrl: 'https://npm.mobiscroll.com/-/v1/done/nw-done',
            deviceUrl: 'https://mobiscroll.com/device',
            code: 'NWNW-NWNW',
          },
        },
      ];
      return webLogin
        .webLogin({ registryUrl: 'https://npm.mobiscroll.com', openBrowser: false, cliVersion: '9.9.9', noWait: true })
        .then((result) => {
          assert.deepStrictEqual(result, { pending: true });
          assert.strictEqual(requests.length, 1, 'no polling');
          const out = printed.join('\n');
          assert.ok(out.indexOf('https://mobiscroll.com/cli/approve?id=nw') !== -1, 'link printed');
          assert.ok(out.indexOf('https://mobiscroll.com/device') !== -1, '/device printed');
          assert.strictEqual(pendingState().doneUrl, 'https://npm.mobiscroll.com/-/v1/done/nw-done');
        });
    },
  },
  {
    name: '--no-wait again while still waiting: no new sign-in, the same link again',
    run: () => {
      answers = [{ status: 202, headers: { 'retry-after': '2' }, data: {} }];
      return webLogin
        .webLogin({ registryUrl: 'https://npm.mobiscroll.com', openBrowser: false, cliVersion: '9.9.9', noWait: true })
        .then((result) => {
          assert.deepStrictEqual(result, { pending: true });
          assert.strictEqual(requests.length, 1);
          assert.strictEqual(requests[0].method, 'get', 'checks the kept sign-in, starts none');
          assert.strictEqual(requests[0].url, 'https://npm.mobiscroll.com/-/v1/done/nw-done');
          assert.ok(printed.join('\n').indexOf('NWNW-NWNW') !== -1, 'the same code again');
          assert.ok(pendingState(), 'still kept');
        });
    },
  },
  {
    name: '--no-wait, then a normal run: waits for the kept sign-in and forgets it',
    run: () => {
      answers = [
        { status: 202, headers: { 'retry-after': '2' }, data: {} },
        { status: 202, headers: { 'retry-after': '2' }, data: {} },
        { status: 200, data: { token: 'KEPT-TOKEN', username: 'anna@acme.com' } },
      ];
      return webLogin.webLogin({ registryUrl: 'https://npm.mobiscroll.com', openBrowser: false, cliVersion: '9.9.9' }).then((result) => {
        assert.strictEqual(result.token, 'KEPT-TOKEN');
        assert.ok(requests.every((r) => r.method === 'get'), 'no new sign-in started');
        assert.strictEqual(pendingState(), undefined, 'forgotten');
        assert.ok(printed.join('\n').indexOf('KEPT-TOKEN') === -1, 'token never printed');
      });
    },
  },
  {
    name: '--no-wait: an approved kept sign-in is collected straight away',
    run: () => {
      writePending({ team: false });
      answers = [{ status: 200, data: { token: 'T3', username: 'x' } }];
      return webLogin
        .webLogin({ registryUrl: 'https://npm.mobiscroll.com', openBrowser: false, cliVersion: '9.9.9', noWait: true })
        .then((result) => {
          assert.strictEqual(result.token, 'T3');
          assert.strictEqual(requests.length, 1);
          assert.strictEqual(pendingState(), undefined);
        });
    },
  },
  {
    name: '--no-wait: a denied or expired kept sign-in is forgotten and a new one started',
    run: () => {
      writePending({ team: false });
      answers = [
        { status: 410, data: { error: 'The sign-in expired. Start it again.' } },
        { status: 200, data: { loginUrl: 'https://mobiscroll.com/cli/approve?id=new', doneUrl: 'https://npm.mobiscroll.com/-/v1/done/new', code: 'NEWW-NEWW' } },
      ];
      return webLogin
        .webLogin({ registryUrl: 'https://npm.mobiscroll.com', openBrowser: false, cliVersion: '9.9.9', noWait: true })
        .then((result) => {
          assert.deepStrictEqual(result, { pending: true });
          assert.strictEqual(requests[1].method, 'post', 'new sign-in');
          assert.strictEqual(pendingState().doneUrl, 'https://npm.mobiscroll.com/-/v1/done/new');
        });
    },
  },
  {
    name: '--no-wait: a kept sign-in is not reused with another --team setting or after it expired',
    run: () => {
      writePending({ team: true });
      answers = [{ status: 200, data: { loginUrl: 'https://mobiscroll.com/cli/approve?id=p', doneUrl: 'https://npm.mobiscroll.com/-/v1/done/p' } }];
      return webLogin
        .webLogin({ registryUrl: 'https://npm.mobiscroll.com', openBrowser: false, cliVersion: '9.9.9', noWait: true })
        .then(() => {
          assert.strictEqual(requests[0].method, 'post', 'team sign-in kept, a personal one started');

          reset();
          writePending({ team: false, expiresAt: Date.now() - 1000 });
          answers = [{ status: 200, data: { loginUrl: 'https://mobiscroll.com/cli/approve?id=q', doneUrl: 'https://npm.mobiscroll.com/-/v1/done/q' } }];
          return webLogin.webLogin({ registryUrl: 'https://npm.mobiscroll.com', openBrowser: false, cliVersion: '9.9.9', noWait: true });
        })
        .then(() => {
          assert.strictEqual(requests[0].method, 'post', 'expired one not checked');
          clearPendingState();
        });
    },
  },
  {
    name: 'token: project .npmrc wins over the user-level one, ${VAR} is expanded',
    run: () => {
      const project = path.join(tmpRoot, 'project');
      fs.mkdirSync(project, { recursive: true });
      fs.writeFileSync(path.join(home, '.npmrc'), '//npm.mobiscroll.com/:_authToken=USER-LEVEL\n');
      assert.strictEqual(npmToken.readNpmToken({ currDir: project, registryUrl: 'https://npm.mobiscroll.com' }), 'USER-LEVEL');

      fs.writeFileSync(
        path.join(project, '.npmrc'),
        '@mobiscroll:registry=https://npm.mobiscroll.com\n//npm.mobiscroll.com/:_authToken=${MBSC_TEST_TOKEN}\n',
      );
      process.env.MBSC_TEST_TOKEN = 'FROM-ENV';
      assert.strictEqual(npmToken.readNpmToken({ currDir: project, registryUrl: 'https://npm.mobiscroll.com' }), 'FROM-ENV');
      assert.strictEqual(npmToken.tokenFromNpmrc(path.join(project, '.npmrc'), 'https://npm.mobiscroll.com', true), '${MBSC_TEST_TOKEN}');
      delete process.env.MBSC_TEST_TOKEN;
      return Promise.resolve();
    },
  },
  {
    name: 'token: Yarn 2+ .yarnrc.yml with ${VAR-} default',
    run: () => {
      const project = path.join(tmpRoot, 'yarn-project');
      fs.mkdirSync(project, { recursive: true });
      fs.unlinkSync(path.join(home, '.npmrc'));
      fs.writeFileSync(
        path.join(project, '.yarnrc.yml'),
        'npmScopes:\n  mobiscroll:\n    npmRegistryServer: https://npm.mobiscroll.com\n    npmAuthToken: ${MBSC_TEST_TOKEN-}\n',
      );
      assert.strictEqual(npmToken.readNpmToken({ currDir: project, registryUrl: 'https://npm.mobiscroll.com' }), '');
      process.env.MBSC_TEST_TOKEN = 'YARN-ENV';
      assert.strictEqual(npmToken.readNpmToken({ currDir: project, registryUrl: 'https://npm.mobiscroll.com' }), 'YARN-ENV');
      delete process.env.MBSC_TEST_TOKEN;
      return Promise.resolve();
    },
  },
  {
    name: 'logout: cancels a real token on the registry, never a ${VAR} reference',
    run: () => {
      const project = path.join(tmpRoot, 'logout-project');
      fs.mkdirSync(project, { recursive: true });
      const npmrc = path.join(project, '.npmrc');
      // the registry the CLI is built for (utils.npmUrl)
      const registryHost = utils.npmUrl.replace(/^https?:\/\//, '');
      fs.writeFileSync(npmrc, '//' + registryHost + '/:_authToken=ab+c/d=\n');
      answers = [{ status: 200, data: { ok: 'Logged out' } }];
      return utils
        .cancelRegistryToken(npmrc)
        .then(() => {
          assert.strictEqual(requests.length, 1);
          assert.strictEqual(requests[0].method, 'delete');
          assert.strictEqual(requests[0].url, utils.npmUrl + '/-/user/token/' + encodeURIComponent('ab+c/d='));
          assert.strictEqual(requests[0].headers.Authorization, 'Bearer ab+c/d=');

          reset();
          fs.writeFileSync(npmrc, '//' + registryHost + '/:_authToken=${MOBISCROLL_NPM_TOKEN}\n');
          return utils.cancelRegistryToken(npmrc);
        })
        .then(() => {
          assert.strictEqual(requests.length, 0, 'a reference is not cancelled');
        });
    },
  },
];

cases
  .reduce(
    (chain, c) =>
      chain.then(() => {
        reset();
        return Promise.resolve()
          .then(c.run)
          .then(
            () => {
              passed++;
              log('  ✓ ' + c.name);
            },
            (err) => {
              failed++;
              log('  ✗ ' + c.name + '\n    ' + (err && err.stack ? err.stack : err));
            },
          );
      }),
    Promise.resolve(),
  )
  .then(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    process.env.HOME = realHome;
    log(`\n${passed} passed, ${failed} failed`);
    if (failed) {
      process.exit(1);
    }
  });
