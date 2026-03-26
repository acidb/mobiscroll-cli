/**
 * Output test for installMobiscroll command generation.
 * Mocks network and shell execution, then prints the actual npm command
 * produced for every scenario so you can verify them visually.
 *
 * Run with: node tests/integration/test-install-commands.js
 */

'use strict';

// ── Stub child_process (must be done before any require of utils) ──────────
const cp = require('child_process');
const captured = [];
cp.exec = (cmd, cb) => {
  captured.push(cmd);
  cb(null, 'ok', '');
};
cp.execSync = (cmd, _opts) => {
  if (cmd === 'yarn -v') throw new Error('yarn not present in test harness');
  return Buffer.from('');
};

// ── Stub axios (must be done before any require of utils) ──────────────────
const axiosPath = require.resolve('axios');
require.cache[axiosPath] = {
  id: axiosPath,
  filename: axiosPath,
  loaded: true,
  exports: Object.assign(
    (_opts) => Promise.resolve({ data: { Version: global.__mbscVersion || '6.0.0' } }),
    { defaults: { headers: {} } }
  ),
};

const utils = require('../../src/utils.js');

function normalize(cmd) {
  return (cmd || '').replace(/\s+/g, ' ').trim();
}

async function runCase(tc) {
  captured.length = 0;
  global.__mbscVersion = tc.version;

  const cfg = {
    projectType: tc.projectType,
    currDir: process.cwd(),
    useTrial: !!tc.isTrial,
    mobiscrollVersion: tc.version,
    proxyUrl: '',
    packageJson: tc.packageJson,
    legacyPeerFlag: false,
    package: tc.pkg,
  };

  // Silence utils.js's own progress messages while capturing the npm command
  const origLog = console.log;
  console.log = () => {};
  try {
    await new Promise((resolve, reject) => {
      try {
        utils.installMobiscroll(cfg, () => resolve());
      } catch (e) {
        reject(e);
      }
    });
  } finally {
    console.log = origLog;
  }

  return normalize(captured[captured.length - 1]);
}

// ── Test matrix ────────────────────────────────────────────────────────────
(async () => {
  const angular13      = { dependencies: { '@angular/core': '^13.2.0' } };
  const angular12      = { dependencies: { '@angular/core': '^12.2.0' } };
  const react18        = { dependencies: { react: '^18.2.0' } };
  const react17        = { dependencies: { react: '^17.0.2' } };
  const vue3           = { dependencies: { vue: '^3.4.0' } };
  const jquery         = { dependencies: { jquery: '^3.7.0' } };
  const js             = { dependencies: {} };
  const ionicAngular13 = { dependencies: { '@ionic/angular': '^7.0.0', '@angular/core': '^13.2.0' } };
  const ionicAngular12 = { dependencies: { '@ionic/angular': '^7.0.0', '@angular/core': '^12.2.0' } };
  const ionicReact18   = { dependencies: { '@ionic/react':   '^8.0.0', react: '^18.2.0' } };
  const ionicReact17   = { dependencies: { '@ionic/react':   '^8.0.0', react: '^17.0.2' } };
  const ionicVue       = { dependencies: { '@ionic/vue':     '^7.0.0', vue: '^3.4.0' } };

  const groups = [
    {
      title: 'v6 — Angular',
      cases: [
        { name: 'angular full   / Angular 13+ (Ivy)',        projectType: 'angular', pkg: 'angular',           version: '6.0.0', packageJson: angular13 },
        { name: 'angular full   / Angular 12  (legacy)',     projectType: 'angular', pkg: 'angular',           version: '6.0.0', packageJson: angular12 },
        { name: 'datepicker-ang / Angular 13+ (Ivy)',        projectType: 'angular', pkg: 'datepicker-angular', version: '6.0.0', packageJson: angular13 },
        { name: 'datepicker-ang / Angular 12  (legacy)',     projectType: 'angular', pkg: 'datepicker-angular', version: '6.0.0', packageJson: angular12 },
        { name: 'angular trial  / Angular 13+ (Ivy)',        projectType: 'angular', pkg: 'angular',           version: '6.0.0', packageJson: angular13, isTrial: true },
        { name: 'angular trial  / Angular 12  (legacy)',     projectType: 'angular', pkg: 'angular',           version: '6.0.0', packageJson: angular12, isTrial: true },
        { name: 'dp-ang trial   / Angular 13+ (Ivy)',        projectType: 'angular', pkg: 'datepicker-angular', version: '6.0.0', packageJson: angular13, isTrial: true },
        { name: 'dp-ang trial   / Angular 12  (legacy)',     projectType: 'angular', pkg: 'datepicker-angular', version: '6.0.0', packageJson: angular12, isTrial: true },
      ],
    },
    {
      title: 'v6 — React',
      cases: [
        { name: 'react full     / React 18+',                projectType: 'react', pkg: 'react',              version: '6.0.0', packageJson: react18 },
        { name: 'react full     / React 17 (legacy)',        projectType: 'react', pkg: 'react',              version: '6.0.0', packageJson: react17 },
        { name: 'datepicker-rct / React 18+',               projectType: 'react', pkg: 'datepicker-react',   version: '6.0.0', packageJson: react18 },
        { name: 'datepicker-rct / React 17 (legacy)',       projectType: 'react', pkg: 'datepicker-react',   version: '6.0.0', packageJson: react17 },
        { name: 'react trial    / React 18+',                projectType: 'react', pkg: 'react',              version: '6.0.0', packageJson: react18, isTrial: true },
        { name: 'react trial    / React 17 (legacy)',        projectType: 'react', pkg: 'react',              version: '6.0.0', packageJson: react17, isTrial: true },
        { name: 'datepicker-rct trial / React 18+',         projectType: 'react', pkg: 'datepicker-react',   version: '6.0.0', packageJson: react18, isTrial: true },
        { name: 'datepicker-rct trial / React 17 (legacy)', projectType: 'react', pkg: 'datepicker-react',   version: '6.0.0', packageJson: react17, isTrial: true },
      ],
    },
    {
      title: 'v6 — Other frameworks',
      cases: [
        { name: 'vue',         projectType: 'vue',        pkg: 'vue',        version: '6.0.0', packageJson: vue3 },
        { name: 'vue trial',   projectType: 'vue',        pkg: 'vue',        version: '6.0.0', packageJson: vue3, isTrial: true },
        { name: 'javascript',  projectType: 'javascript', pkg: 'javascript', version: '6.0.0', packageJson: js },
        { name: 'javascript trial', projectType: 'javascript', pkg: 'javascript', version: '6.0.0', packageJson: js, isTrial: true },
        { name: 'jquery',      projectType: 'jquery',     pkg: 'jquery',     version: '6.0.0', packageJson: jquery },
        { name: 'jquery trial', projectType: 'jquery',    pkg: 'jquery',     version: '6.0.0', packageJson: jquery, isTrial: true },
      ],
    },
    {
      title: 'v6 — Ionic',
      cases: [
        { name: 'ionic/angular / Angular 13+ (Ivy)',         projectType: 'ionic', pkg: 'angular', version: '6.0.0', packageJson: ionicAngular13 },
        { name: 'ionic/angular / Angular 12  (legacy)',      projectType: 'ionic', pkg: 'angular', version: '6.0.0', packageJson: ionicAngular12 },
        { name: 'ionic/angular trial / Angular 13+ (Ivy)',   projectType: 'ionic', pkg: 'angular', version: '6.0.0', packageJson: ionicAngular13, isTrial: true },
        { name: 'ionic/angular trial / Angular 12  (legacy)',projectType: 'ionic', pkg: 'angular', version: '6.0.0', packageJson: ionicAngular12, isTrial: true },
        { name: 'ionic/react   / React 18+',                 projectType: 'ionic', pkg: 'react',   version: '6.0.0', packageJson: ionicReact18 },
        { name: 'ionic/react   / React 17 (legacy)',         projectType: 'ionic', pkg: 'react',   version: '6.0.0', packageJson: ionicReact17 },
        { name: 'ionic/react trial / React 18+',             projectType: 'ionic', pkg: 'react',   version: '6.0.0', packageJson: ionicReact18, isTrial: true },
        { name: 'ionic/react trial / React 17 (legacy)',     projectType: 'ionic', pkg: 'react',   version: '6.0.0', packageJson: ionicReact17, isTrial: true },
        { name: 'ionic/vue',                                  projectType: 'ionic', pkg: 'vue',     version: '6.0.0', packageJson: ionicVue },
        { name: 'ionic/vue trial',                            projectType: 'ionic', pkg: 'vue',     version: '6.0.0', packageJson: ionicVue, isTrial: true },
      ],
    },
    {
      title: 'v5 — Angular',
      cases: [
        { name: 'angular full   / Angular 13+ (Ivy)',        projectType: 'angular', pkg: 'angular',           version: '5.30.0', packageJson: angular13 },
        { name: 'angular full   / Angular 12',               projectType: 'angular', pkg: 'angular',           version: '5.30.0', packageJson: angular12 },
        { name: 'datepicker-ang / Angular 13+ (Ivy)',        projectType: 'angular', pkg: 'datepicker-angular', version: '5.30.0', packageJson: angular13 },
        { name: 'datepicker-ang / Angular 12',               projectType: 'angular', pkg: 'datepicker-angular', version: '5.30.0', packageJson: angular12 },
        { name: 'angular trial  / Angular 13+ (Ivy)',        projectType: 'angular', pkg: 'angular',           version: '5.30.0', packageJson: angular13, isTrial: true },
        { name: 'angular trial  / Angular 12',               projectType: 'angular', pkg: 'angular',           version: '5.30.0', packageJson: angular12, isTrial: true },
        { name: 'dp-ang trial   / Angular 13+ (Ivy)',        projectType: 'angular', pkg: 'datepicker-angular', version: '5.30.0', packageJson: angular13, isTrial: true },
        { name: 'dp-ang trial   / Angular 12',               projectType: 'angular', pkg: 'datepicker-angular', version: '5.30.0', packageJson: angular12, isTrial: true },
      ],
    },
    {
      title: 'v5 — React',
      cases: [
        { name: 'react full     / React 18+ (next)',         projectType: 'react', pkg: 'react',             version: '5.30.0', packageJson: react18 },
        { name: 'react full     / React 17',                 projectType: 'react', pkg: 'react',             version: '5.30.0', packageJson: react17 },
        { name: 'datepicker-rct / React 18+ (next)',        projectType: 'react', pkg: 'datepicker-react',  version: '5.30.0', packageJson: react18 },
        { name: 'datepicker-rct / React 17',                projectType: 'react', pkg: 'datepicker-react',  version: '5.30.0', packageJson: react17 },
        { name: 'react trial    / React 18+ (next)',         projectType: 'react', pkg: 'react',             version: '5.30.0', packageJson: react18, isTrial: true },
        { name: 'react trial    / React 17',                 projectType: 'react', pkg: 'react',             version: '5.30.0', packageJson: react17, isTrial: true },
        { name: 'dp-rct trial   / React 18+ (next)',         projectType: 'react', pkg: 'datepicker-react',  version: '5.30.0', packageJson: react18, isTrial: true },
        { name: 'dp-rct trial   / React 17',                 projectType: 'react', pkg: 'datepicker-react',  version: '5.30.0', packageJson: react17, isTrial: true },
      ],
    },
    {
      title: 'v5 — Ionic',
      cases: [
        { name: 'ionic/angular / Angular 13+ (Ivy)',         projectType: 'ionic', pkg: 'angular', version: '5.30.0', packageJson: ionicAngular13 },
        { name: 'ionic/angular / Angular 12',                projectType: 'ionic', pkg: 'angular', version: '5.30.0', packageJson: ionicAngular12 },
        { name: 'ionic/angular trial / Angular 13+ (Ivy)',   projectType: 'ionic', pkg: 'angular', version: '5.30.0', packageJson: ionicAngular13, isTrial: true },
        { name: 'ionic/angular trial / Angular 12',          projectType: 'ionic', pkg: 'angular', version: '5.30.0', packageJson: ionicAngular12, isTrial: true },
        { name: 'ionic/react   / React 18+ (next)',          projectType: 'ionic', pkg: 'react',   version: '5.30.0', packageJson: ionicReact18 },
        { name: 'ionic/react   / React 17',                  projectType: 'ionic', pkg: 'react',   version: '5.30.0', packageJson: ionicReact17 },
        { name: 'ionic/react trial / React 18+ (next)',      projectType: 'ionic', pkg: 'react',   version: '5.30.0', packageJson: ionicReact18, isTrial: true },
        { name: 'ionic/react trial / React 17',              projectType: 'ionic', pkg: 'react',   version: '5.30.0', packageJson: ionicReact17, isTrial: true },
        { name: 'ionic/vue',                                  projectType: 'ionic', pkg: 'vue',     version: '5.30.0', packageJson: ionicVue },
        { name: 'ionic/vue trial',                            projectType: 'ionic', pkg: 'vue',     version: '5.30.0', packageJson: ionicVue, isTrial: true },
      ],
    },
    {
      title: 'v5 — Other frameworks',
      cases: [
        { name: 'vue',        projectType: 'vue',        pkg: 'vue',        version: '5.30.0', packageJson: vue3 },
        { name: 'javascript', projectType: 'javascript', pkg: 'javascript', version: '5.30.0', packageJson: js },
        { name: 'jquery',     projectType: 'jquery',     pkg: 'jquery',     version: '5.30.0', packageJson: jquery },
        { name: 'vue trial',  projectType: 'vue',        pkg: 'vue',        version: '5.30.0', packageJson: vue3, isTrial: true },
        { name: 'js trial',   projectType: 'javascript', pkg: 'javascript', version: '5.30.0', packageJson: js, isTrial: true },
        { name: 'jquery trial', projectType: 'jquery',   pkg: 'jquery',     version: '5.30.0', packageJson: jquery, isTrial: true },
      ],
    },
  ];

  const DIVIDER = '─'.repeat(72);
  const HEAVY   = '═'.repeat(72);

  console.log('\n' + HEAVY);
  console.log('  installMobiscroll — generated commands');
  console.log(HEAVY + '\n');

  for (let g = 0; g < groups.length; g++) {
    const group = groups[g];

    if (g > 0) {
      console.log('\n' + DIVIDER);
    }

    // Title styled after the CLI success messages, e.g. "Mobiscroll for Angular installed."
    const friendlyTitle = group.title.replace(/^v\d+\s+[—–-]+\s*/i, '').trim();
    const vMatch = group.title.match(/^(v\d+)/i);
    const vTag = vMatch ? ` (${vMatch[1]})` : '';
    console.log(`\n  Mobiscroll for ${friendlyTitle} — scenarios${vTag}\n`);

    for (const tc of group.cases) {
      const cmd = await runCase(tc);

      // Readable input summary
      const trial = tc.isTrial ? '  trial: yes' : '  trial: no ';
      const deps = Object.entries(tc.packageJson.dependencies || {})
        .map(([k, v]) => `${k}@${v}`)
        .join(', ') || '(none)';
      console.log(`  ┌─ ${tc.name}`);
      console.log(`  │  pkg: ${tc.pkg}  |  version: ${tc.version}  |${trial}  |  deps: ${deps}`);
      console.log(`  └► ${cmd}`);
      console.log('');
    }
  }

  console.log(HEAVY + '\n');
})();
