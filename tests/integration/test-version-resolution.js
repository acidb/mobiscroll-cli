/**
 * Tests for framework version resolution (catalog:, ranges, aliases, dev/peer deps, node_modules).
 *
 * Run with: node tests/integration/test-version-resolution.js
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Stub axios before requiring utils (resolved at load time)
const axiosPath = require.resolve('axios');
require.cache[axiosPath] = { id: axiosPath, filename: axiosPath, loaded: true, exports: Object.assign(() => Promise.resolve({ data: {} }), { defaults: { headers: {} } }) };

const utils = require('../../src/utils.js');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mbsc-version-'));

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
}

// Creates a monorepo with one member package; returns the member dir
function makeMonorepo(name, rootFiles, memberPkg) {
  const root = path.join(tmpRoot, name);
  write(path.join(root, 'package.json'), rootFiles['package.json'] || { name: 'root', private: true, workspaces: ['packages/*'] });
  Object.keys(rootFiles).forEach((f) => f !== 'package.json' && write(path.join(root, f), rootFiles[f]));
  const member = path.join(root, 'packages', 'app');
  write(path.join(member, 'package.json'), memberPkg);
  return member;
}

const warnings = [];
const origLog = console.log;

const cases = [
  ['plain caret range', () => ({ dir: tmpRoot, pkg: { dependencies: { '@angular/core': '^17.1.0' } } }), '17.1.0'],
  ['partial major', () => ({ dir: tmpRoot, pkg: { dependencies: { react: '^18' } } }), '18.0.0'],
  ['>= range', () => ({ dir: tmpRoot, pkg: { dependencies: { react: '>=18.0.0' } } }), '18.0.0'],
  ['range alternatives use lowest', () => ({ dir: tmpRoot, pkg: { dependencies: { react: '^18 || ^19' } } }), '18.0.0'],
  ['npm alias', () => ({ dir: tmpRoot, pkg: { dependencies: { react: 'npm:react@18.3.1' } } }), '18.3.1'],
  ['devDependencies', () => ({ dir: tmpRoot, pkg: { devDependencies: { '@angular/core': '~16.2.0' } } }), '16.2.0'],
  ['peerDependencies', () => ({ dir: tmpRoot, pkg: { peerDependencies: { react: '^19.0.0' } } }), '19.0.0'],
  ['missing dependencies', () => ({ dir: tmpRoot, pkg: {} }), null],
  [
    'pnpm default catalog',
    () => ({
      dir: makeMonorepo('pnpm-default', { 'pnpm-workspace.yaml': "packages:\n  - 'packages/*'\ncatalog:\n  '@angular/core': ^19.0.0\n" }, {}),
      pkg: { dependencies: { '@angular/core': 'catalog:' } },
    }),
    '19.0.0',
  ],
  [
    'pnpm named catalog',
    () => ({
      dir: makeMonorepo('pnpm-named', { 'pnpm-workspace.yaml': "packages:\n  - 'packages/*'\ncatalogs:\n  ng:\n    '@angular/core': ~18.2.0\n" }, {}),
      pkg: { dependencies: { '@angular/core': 'catalog:ng' } },
    }),
    '18.2.0',
  ],
  [
    'yarn catalog',
    () => ({
      dir: makeMonorepo('yarn', { '.yarnrc.yml': "catalog:\n  react: ^18.3.0\n" }, {}),
      pkg: { dependencies: { react: 'catalog:' } },
    }),
    '18.3.0',
  ],
  [
    'root package.json catalog (bun)',
    () => ({
      dir: makeMonorepo('bun', { 'package.json': { name: 'root', workspaces: { packages: ['packages/*'], catalog: { react: '^19.0.0' } } } }, {}),
      pkg: { dependencies: { react: 'catalog:' } },
    }),
    '19.0.0',
  ],
  [
    'workspace: spec falls back to node_modules',
    () => {
      const dir = makeMonorepo('ws', {}, {});
      write(path.join(dir, 'node_modules', 'react', 'package.json'), { name: 'react', version: '18.2.0' });
      return { dir, pkg: { dependencies: { react: 'workspace:*' } } };
    },
    '18.2.0',
  ],
  [
    'catalog spec with no catalog falls back to hoisted node_modules at the root',
    () => {
      const dir = makeMonorepo('hoisted', {}, {});
      write(path.join(tmpRoot, 'hoisted', 'node_modules', '@angular', 'core', 'package.json'), { version: '17.0.0' });
      return { dir, pkg: { dependencies: { '@angular/core': 'catalog:' } } };
    },
    '17.0.0',
  ],
  ['unresolvable spec', () => ({ dir: tmpRoot, pkg: { dependencies: { react: 'latest' } } }), null, true],
];

let failed = 0;
cases.forEach(([name, setup, expected, expectWarning]) => {
  const { dir, pkg } = setup();
  warnings.length = 0;
  console.log = (msg) => warnings.push(String(msg));
  let actual;
  try {
    const pkgName = Object.keys(Object.assign({}, pkg.dependencies, pkg.devDependencies, pkg.peerDependencies))[0] || 'react';
    actual = utils.resolvePackageVersion(pkg, pkgName, dir);
  } finally {
    console.log = origLog;
  }
  try {
    assert.strictEqual(actual, expected);
    assert.strictEqual(warnings.length > 0, !!expectWarning, `warning expectation: ${warnings.join('|')}`);
    console.log(`  ✓ ${name}  →  ${actual}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}: expected ${expected}, got ${actual} (${e.message})`);
  }
});

// Main-version helpers and their fallbacks
assert.strictEqual(utils.getMainAngularVersion({ dependencies: { '@angular/core': '^12.0.0' } }, tmpRoot), 12);
assert.ok(utils.getMainAngularVersion({ dependencies: {} }, tmpRoot) >= 13, 'unknown Angular is assumed modern');
assert.strictEqual(utils.getMainPackageVersion({ dependencies: { react: '^17.0.2' } }, 'react', tmpRoot), 17);

fs.rmSync(tmpRoot, { recursive: true, force: true });

if (failed) {
  console.log(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log('\nAll version resolution cases passed');
