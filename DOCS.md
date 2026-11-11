# Mobiscroll CLI — Internal Team Documentation

**Package:** `@mobiscroll/cli` · **Current version:** 1.16.2 · **Published to:** npmjs.com (public)

This document is the starting point for anyone on the team working on the CLI — new contributors, reviewers, or anyone shipping a release.

---

## Table of Contents

1. [What the CLI does](#what-the-cli-does)
2. [Quick start for contributors](#quick-start-for-contributors)
3. [Repository layout](#repository-layout)
4. [Dependencies](#dependencies)
5. [Commands reference](#commands-reference)
6. [Architecture overview](#architecture-overview)
7. [How install commands are built](#how-install-commands-are-built)
8. [Framework-specific config](#framework-specific-config)
9. [Authentication flow](#authentication-flow)
10. [Adding a new framework or flag](#adding-a-new-framework-or-flag)
11. [Testing](#testing)
12. [Release process](#release-process)
13. [Known gotchas & decisions](#known-gotchas--decisions)

---

## What the CLI does

The CLI's job is to get Mobiscroll installed and configured in a customer's project in one command. It:

- Authenticates the customer with the Mobiscroll npm registry (`npm.mobiscroll.com`)
- Calls the Mobiscroll API to verify their license and get the correct package name/version
- Runs the right `npm install` / `yarn add` / `pnpm add` command for their framework and version
- For Angular and Ionic: actually modifies project files (module imports, `angular.json`, SCSS, etc.)
- For React, Vue, jQuery, JS: prints copy-paste code snippets the customer uses manually
- `mobiscroll start` clones a demo/starter project from GitHub so customers can get running fast

---

## Quick start for contributors

```bash
# Clone and install
git clone https://github.com/acidb/mobiscroll-cli.git
cd mobiscroll-cli
npm install

# Run the CLI in development (without installing globally)
node mobiscroll.js --help
node mobiscroll.js config angular --trial

# Install globally so you can use the `mobiscroll` binary
npm install -g .
mobiscroll config react

# Run the integration test suite
node tests/integration/test-install-commands.js

# Lint
npx eslint mobiscroll.js src/
```

> **Tip:** Use a throwaway Angular or React project to test real installations end-to-end. Create one with `npx create-react-app test-project` or `npx @angular/cli new test-project`.

---

## Repository layout

```
mobiscroll-cli/
├── mobiscroll.js               # Entry point — CLI parsing, command handlers
├── package.json
├── CHANGELOG.md                # Human-readable version history
├── src/
│   ├── utils.js                # All shared helpers: install commands, API calls, file I/O, auth
│   ├── configAngular.js        # Angular file modifications (app.module.ts, angular.json, SCSS)
│   ├── configIonic.js          # Ionic file modifications (index.html, variables.scss, copy scripts)
│   ├── helperMessages.js       # Printed usage instructions for React/Vue/jQuery/JS
│   └── npm-login/              # Custom npm login implementation
│       ├── index.js
│       ├── login.js
│       └── adduser.js
├── resources/                  # Template files copied into user projects (--no-npm installs)
│   ├── angular/, ionic/, react/, vue/, javascript/, jquery/
│   └── ionic/scripts/copy-mobiscroll-css.js
├── scripts/
│   └── normalize-line-endings.js   # Prepublish hook: CRLF → LF on mobiscroll.js
└── tests/
    └── integration/
        └── test-install-commands.js
```

**One-line role for each key file:**

| File | Role |
|---|---|
| `mobiscroll.js` | All `commander` definitions, option handlers, `checkUpdate()` |
| `src/utils.js` | Shared logic only — no framework branching allowed here |
| `src/configAngular.js` | Everything Angular touches on disk |
| `src/configIonic.js` | Everything Ionic touches on disk |
| `src/helperMessages.js` | Output strings only, no side effects |

---

## Dependencies

All dependencies are runtime (no separate devDependencies). Here's what each one does and where it's used:

| Package | Version | Role | Where used |
|---|---|---|---|
| **commander** | `^2.19.0` | CLI skeleton — parses commands, subcommands, options, and flags | `mobiscroll.js` — all command/option definitions |
| **inquirer** | `^8.1.0` | Interactive terminal prompts (username/password inputs, yes/no confirmations, select lists) | `mobiscroll.js`, `src/utils.js` — login prompts, SCSS/CSS choice, overwrite confirmations |
| **chalk** | `^2.4.1` | Terminal colors and text styling (green success, red errors, yellow warnings) | `src/utils.js` — `printFeedback`, `printWarning`, `printError`, `printLog` helpers |
| **figlet** | `^1.2.1` | ASCII art banner printed at CLI startup | `mobiscroll.js` — the "Mobiscroll" header shown on every run |
| **axios** | `1.13.6` | HTTP client for Mobiscroll API calls (license check, version fetch) | `src/utils.js` — `getApiKey()`, `getMobiscrollVersion()` |
| **js-yaml** | `^4.1.0` | Parses and writes `.yarnrc.yml` for Yarn 2+ auth token sync | `src/utils.js` — `updateAuthTokenInYarnrc()` |
| **semver** | `^6.3.0` | Compares and validates version strings to decide which package variant to install | `src/utils.js` — v5 vs v6 branching, Angular/React version checks in install logic |
| **ncp** | `^2.0.0` | Recursively copies directory trees (used for `--no-npm` resource template copying) | `src/utils.js` — `packMobiscroll()` |
| **terminal-link** | `^1.2.0` | Creates clickable hyperlinks in terminals that support them (docs links, demo links) | `src/helperMessages.js` — links to Mobiscroll docs printed after config |

### Internal module: `src/npm-login/`

This is a local custom module (not an npm package) that handles authenticating with the Mobiscroll npm registry. It is split into three files:

| File | Role |
|---|---|
| `index.js` | Promise wrapper — the public API called by `src/utils.js` |
| `login.js` | Makes the registry API call to exchange credentials for an auth token |
| `adduser.js` | Handles new user registration against the registry |

**Why not use the standard `npm login` command?** The standard CLI tool has known issues in non-interactive environments and doesn't reliably handle custom registry token formats. This custom implementation gives full control over the request/response cycle and works consistently across environments.

### Why commander v2?

Commander's API changed significantly at v3 — option parsing behavior, how boolean flags work, and how subcommands are defined all differ. The CLI was built against v2 and relies on its specific behavior. **Do not upgrade** without thoroughly retesting every command and flag combination.

### Why inquirer v8?

Inquirer v9+ switched to ESM-only distribution, which is incompatible with this project's CommonJS (`require()`-based) module system. v8 is the last version that works with `require('inquirer')` without any build tooling changes. **Do not upgrade** unless the project is first migrated to ESM or a bundler is introduced.

### The `overrides` field in package.json

```json
"overrides": {
  "external-editor": { "tmp": "0.2.4" }
}
```

This forces `inquirer`'s transitive dependency `external-editor` to use a patched version of `tmp` (a temp file utility). It was added to resolve a security audit finding. Don't remove it.

---

## Commands reference

### `mobiscroll config <type>`

Installs and configures Mobiscroll in an existing project.

**Supported types:** `angular` · `ionic` · `react` · `vue` · `jquery` · `javascript`

| Flag | Description |
|---|---|
| `-t, --trial` | Install trial/evaluation configuration |
| `-i, --lite` | Install lite variant (fewer components) |
| `-n, --no-npm` | Skip npm install; expect files at `src/lib/mobiscroll/` |
| `--version <version>` | Pin a specific Mobiscroll version, e.g. `5.23.0` or `6` |
| `--proxy <url>` | HTTP proxy, supports auth: `protocol://user:pass@host:port` |
| `--scss` / `--css` | Force stylesheet format (skips interactive prompt) |
| `--legacy-peer-deps` | Passes `--legacy-peer-deps` to npm install |
| `-g, --global` | Write auth to global `~/.npmrc` instead of local `.npmrc` |
| `--password` | Old user name + password (or team secret) prompt instead of the browser sign-in |
| `--no-wait` | Start the browser sign-in, print the link and code, and exit 0. The next run picks the sign-in up (see Authentication flow) |
| `-y, --yes` | Program-level: never prompt. Automatic when stdin/stdout is not a TTY (AI agents, scripts) |

**What it does in order:**
1. Reads the project's `package.json` to detect framework version
2. Verifies Mobiscroll npm credentials, starts the browser sign-in if needed
3. Asks the registry (`GET /-/mobiscroll/access/<framework>` with the token) to check the license and get the right package name
4. Builds and runs the `npm install` / `yarn add` / `pnpm add` command
5. Modifies config files (Angular/Ionic only)
6. Prints usage instructions

---

### `mobiscroll login`

Authenticates with the Mobiscroll npm registry through the browser (see Authentication flow). Saves auth token to `.npmrc` (and `.yarnrc.yml` for Yarn 2+ projects). Use `-g` to write to global config. Flags: `--password`, `--no-wait`, `--proxy`. To sign in as the team npm user, pick it on the approve page.

---

### `mobiscroll logout`

Cancels the token on the registry (`DELETE /-/user/token/<token>`; the registry cancels personal tokens only, and a `${VAR}` reference is never sent), then removes credentials from `.npmrc` and `.yarnrc.yml`.

---

### `mobiscroll start <type> [name]`

Clones a Mobiscroll demo project from GitHub and installs its dependencies.

**Supported types:** `angular` · `react` · `react-ts` · `vue` · `vue-ts` · `javascript` · `jquery`

Clones from `https://github.com/acidb/mobiscroll-demos-<type>`. Prompts for project name if not provided; warns before overwriting an existing directory.

---

## Architecture overview

```
mobiscroll.js  ──parse flags──►  settings object
                                      │
                              checkMbscNpmLogin()
                                      │
                               getApiKey() (API call)
                                      │
                     ┌────────────────┼───────────────────┐
                     ▼                ▼                    ▼
             configAngular()   configIonic()      helperMessages
             (modifies files)  (modifies files)   (prints snippets)
                     │                │
              installMobiscroll() ◄───┘   ← builds & runs npm/yarn/pnpm command
```

**Key design rules:**
- `settings` is the single source of truth for a command invocation — module-level vars in `mobiscroll.js` are written to `settings` once and never read directly inside `src/`
- `installMobiscroll()` only builds and runs the install command — file modifications always happen after
- `src/utils.js` has no framework-specific branching — that belongs in config files
- `helperMessages.js` contains only output, no file writes or `run()` calls

---

## How install commands are built

This is the most complex part of the codebase. Package names differ by Mobiscroll version:

**v5:** Angular uses `@mobiscroll/angular-ivy` (Angular 13+, from v5.23.0) or `@mobiscroll/angular` (Angular 9–12). React uses `@mobiscroll/react-next` (React 18+, from v5.30.0) or `@mobiscroll/react`.

**v6+:** The `-ivy` and `-next` variants became the "main" packages, and the old names got a `-legacy` suffix. So `angular-ivy` → `angular`, `angular` → `angular-legacy`, `react-next` → `react`, `react` → `react-legacy`. When the legacy variant is needed, an npm alias is used so the import name in the project stays stable (e.g. `@mobiscroll/angular@npm:@mobiscroll/angular-legacy@<version>`).

Trial and lite variants append `-trial` or `-lite` to the package name.

The full logic lives in `installMobiscroll()` in `src/utils.js`. The integration tests cover 60+ combinations of version × framework × package manager — always run them after touching install logic.

**Package manager detection** (checked at monorepo root, up to 5 levels up):
- `pnpm-lock.yaml` present → pnpm
- `yarn.lock` present → yarn (v1 or v2+, detected by `.yarnrc.yml`)
- Otherwise → npm

---

## Framework-specific config

### Angular (`src/configAngular.js`)

Detects and handles:
- **Module-based apps** (pre-Angular 14): finds `app.module.ts`, injects `MbscModule` import
- **Standalone apps** (Angular 14+): detects `bootstrapApplication` in `main.ts` or `standalone: true` in component, injects into `app.component.ts`
- **SCSS/CSS**: adds stylesheet path to `angular.json` build options; handles both `architect` (new) and `targets` (legacy) JSON structure
- **Ionic+Angular**: detected when `@ionic/angular` is a dependency, then delegates to `configIonic()`

### Ionic (`src/configIonic.js`)

Handles three sub-flavors: Ionic+Angular, Ionic+React, Ionic+Vue.

Actions:
- Adds `ionic_copy` hook to `package.json` config
- Copies `copy-mobiscroll-css.js` script to `src/scripts/`
- Adds `<link>` tag to `src/index.html`
- Inserts SCSS import into `src/theme/variables.scss`

Handles old Ionic 2/3 vs. modern Ionic 4+ configurations.

### React / Vue / jQuery / JavaScript

No file modifications. The config command installs the package and prints copy-paste integration code via `src/helperMessages.js`. Customers add the imports and component usage themselves.

---

## Authentication flow

1. `checkMbscNpmLogin()` runs `npm whoami --registry=https://npm.mobiscroll.com`
2. If that fails, starts the browser sign-in (`src/webLogin.js`, npm's web login protocol on the registry):
   - `POST /-/v1/login` with the machine name, a machine id kept in `~/.mobiscroll/cli.json` → `{ loginUrl, doneUrl, code, deviceUrl }`
   - prints the link, the code and the `/device` page (where the code can be typed on another device), opens the browser (not when `CI` is set)
   - polls `doneUrl` (202 + `Retry-After` while waiting, 200 `{ token }` once approved, 403 denied, 410 expired)
   - With `--no-wait`: doesn't poll. Keeps `{ loginUrl, doneUrl, code, expiresAt }` as `pending` in `~/.mobiscroll/cli.json` and exits 0. The next sign-in for the same registry checks that `doneUrl` first: approved → takes the token; still waiting → waits (or, with `--no-wait` again, prints the same link and exits); denied / expired / used → forgets it and starts a new one. `start` has no `--no-wait` (running it again would hit the existing folder): run `mobiscroll login --no-wait` first.
   - With `--password`: the old username + password prompt and `npmLogin()` (`src/npm-login/`)
3. Writes `//npm.mobiscroll.com/:_authToken=<token>` to `.npmrc` (`npmLogin.saveToken()` for the browser sign-in)
4. If Yarn 2+ is used, syncs the token to `.yarnrc.yml` too
5. Calls `getApiKey()` → `GET https://npm.mobiscroll.com/-/mobiscroll/access/{framework}` with `Authorization: Bearer <token>` (token read by `src/token.js` from the project / user `.npmrc` or `.yarnrc.yml`, `${VAR}` expanded). Falls back to `GET https://api.mobiscroll.com/api/access/{username}/{framework}` when there is no token or the registry doesn't answer.

New tokens carry a random `mbsc_` secret instead of the password (the registry stores only its hash), so they can be listed and cancelled on mobiscroll.com. The registry the CLI talks to is the `mbscNpmUrl` constant at the top of `src/utils.js`; to test against another registry, change it there (it must be `https://npm.mobiscroll.com` in a release).

**Non-interactive mode** (`--yes`, or no TTY): no prompt is shown. The update prompt is skipped with a hint and the stylesheet uses the default. When the licence doesn't cover the framework (or its maintenance has expired), the trial is installed right away with the line "No active licence for @mobiscroll/<framework>: installing the trial. Buy or renew at https://mobiscroll.com/account/licenses"; in a terminal the person is still asked. The project name / overwrite questions stop with exit code 1 and a message naming the argument to add.

**Invariant:** Auth tokens must never appear in log output, error messages, or feedback strings.

**Why a custom npm-login module?** The standard `npm login` CLI has known issues with non-interactive environments and custom registry token formats. The custom implementation in `src/npm-login/` handles this reliably.

---

## Adding a new framework or flag

### New framework type

1. Add the type string to the `config` command in `mobiscroll.js` and the switch in `handleConfig()`
2. Add install command logic in `src/utils.js` → `installMobiscroll()` (follow v5/v6 branching pattern)
3. Add usage instructions in `src/helperMessages.js`
4. If file modifications are needed, create `src/config<Framework>.js` following the Angular/Ionic pattern
5. Add resource templates to `resources/<framework>/` if needed for `--no-npm` installs
6. Add test cases to `tests/integration/test-install-commands.js`

### New CLI flag

1. Declare the option in `mobiscroll.js` with a `handle*()` function and a module-level var
2. Pass the var into the `settings` object before calling `config()`
3. Use `settings.yourFlag` in the relevant handler — never read the module-level var from inside `src/`

---

## Testing

The project has integration tests only — no unit test framework.

```bash
node tests/integration/test-install-commands.js
```

**What is tested:** The `installMobiscroll()` function is called directly with every combination of project type, Mobiscroll version, Angular version, React version, and package manager. The test verifies the generated install command string matches expected output.

**How mocking works:** `child_process.exec`, `execSync`, and `axios` are stubbed **before** `require('./src/utils.js')`. The require happens at load time, so the order matters — stubs must be in place first.

**When to add tests:** Any change to install command logic requires new test cases. The matrix should cover at minimum: npm, yarn, pnpm × affected version range.

**What is not tested:** File modification logic (Angular/Ionic config files), interactive prompts, API calls, and the `start` command.

---

## Release process

1. Make your changes on a branch and open a PR for review
2. Update `CHANGELOG.md` with the version number and a bullet list of changes
3. Bump the version in `package.json` (follow semver: patch for fixes, minor for new features)
4. Merge to main
5. Publish:

```bash
# Log in with the Mobiscroll npm publishing account
npm login --registry=https://npm.mobiscroll.com

# Publish — this runs the prepublish hook (CRLF → LF normalization) automatically
npm publish
```

The `prepublish` hook runs `scripts/normalize-line-endings.js` on `mobiscroll.js` to ensure LF line endings — important for cross-platform installs.

> **Note:** The package is published to the public npm registry (`npmjs.com`), not the Mobiscroll private registry.

---

## Known gotchas & decisions

**`process.env.HOME = process.env.HOME || ''`**
This line near the top of `mobiscroll.js` is intentional. The `npm-login` plugin crashes on Windows if `HOME` is undefined. Do not remove it.

**`commander` is pinned to v2**
The commander API changed significantly between v2 and v3+. The current option parsing relies on v2 behavior. Do not upgrade without thoroughly verifying all option parsing still works.

**Monorepo detection**
`findMonorepoRoot()` walks up 5 directory levels looking for a workspace root (based on lock files). Lock file detection for package manager selection always uses the monorepo root, not the project's own directory. Project file reads/writes (`package.json`, `angular.json`, etc.) always use `currDir`.

**Standalone Angular components**
Angular 14+ introduced standalone components, which don't use `NgModule`. The CLI detects standalone via `bootstrapApplication` in `main.ts` or `standalone: true` in the app component, then injects into the component file instead of `app.module.ts`.

**Yarn 2+ token sync**
Yarn 2+ uses `.yarnrc.yml` and ignores `.npmrc`. Any code path that writes or removes a token from `.npmrc` must also call `updateAuthTokenInYarnrc()` on the same directory. Missing this breaks Yarn 2+ customers.

**Line endings on Windows**
The prepublish hook normalizes `mobiscroll.js` to LF. If you're on Windows, avoid editors that silently commit CRLF to the entry point — it breaks installs on Unix.

**React/Vue don't modify files**
This is by design. React and Vue project structures vary too much to safely automate module injection. The CLI installs the package and trusts the developer to follow the printed instructions.

**`--no-npm` mode**
When `--no-npm` is passed, the CLI skips the npm install entirely and copies files from the `resources/` templates into the user's project. This mode exists for environments where the npm registry is inaccessible. Resource templates must never contain `require()` calls or absolute paths.
