// The --help screens: every option of every command is listed, and AI agents find the --yes --no-wait command.
// Runs the real CLI (help exits before any command runs, so nothing is installed or signed in).
// Run: node tests/integration/test-help.js

const { execFileSync } = require('child_process');
const path = require('path');
const assert = require('assert');

const cli = path.resolve(__dirname, '../../mobiscroll.js');
const version = require('../../package.json').version;

function run(args) {
  return execFileSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
}

const screens = {
  '': {
    usage: 'Usage: mobiscroll <command> [options]',
    has: ['config <type>', 'login', 'logout', 'start <type> <name>', '-g, --global', '-y, --yes', '-v, -V', '-h, --help'],
    agent: 'mobiscroll config react --yes --no-wait',
  },
  config: {
    usage: 'Usage: mobiscroll config <type> [options]',
    has: [
      '-t, --trial',
      '-i, --lite',
      '-n, --no-npm',
      '--version [version]',
      '--scss',
      '--css',
      '--legacy-peer-deps',
      '--proxy [proxy]',
      '--password',
      '--no-wait',
      '-g, -y',
      'angular, ionic, javascript, jquery, react, vue',
    ],
    agent: 'mobiscroll config react --yes --no-wait',
  },
  login: {
    usage: 'Usage: mobiscroll login [options]',
    has: ['--password', '--no-wait', '--proxy [proxy]', '-g, -y'],
    agent: 'mobiscroll login --yes --no-wait',
  },
  logout: { usage: 'Usage: mobiscroll logout [options]', has: ['--proxy [proxy]', '-g '] },
  start: {
    usage: 'Usage: mobiscroll start <type> <name> [options]',
    has: ['-t, --trial', '--password', '--proxy [proxy]', '-g, -y', 'react-ts'],
    agent: 'mobiscroll login -g --yes --no-wait',
  },
};

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok   ' + name);
  } catch (err) {
    failed++;
    console.log('  FAIL ' + name + '\n       ' + err.message);
  }
}

Object.keys(screens).forEach((command) => {
  const screen = screens[command];
  const label = (command ? command + ' ' : '') + '--help';
  const out = run(command ? [command, '--help'] : ['--help']);

  test(label + ': usage line', () => assert.ok(out.startsWith(screen.usage), 'starts with: ' + out.split('\n')[0]));
  screen.has.forEach((text) => test(label + ': lists ' + text.trim(), () => assert.ok(out.includes(text), 'missing: ' + text)));
  if (screen.agent) {
    test(label + ': agent example', () => assert.ok(out.includes(screen.agent), 'missing: ' + screen.agent));
  }
});

test('-help (one dash) shows the main help', () => assert.ok(run(['-help']).startsWith(screens[''].usage)));
test('-v prints the version', () => assert.strictEqual(run(['-v']).trim(), version));
test('-V prints the version', () => assert.strictEqual(run(['-V']).trim(), version));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
