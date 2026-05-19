# Mobiscroll CLI — CLAUDE.md

## Project Overview

`@mobiscroll/cli` is a Node.js CLI tool that automates integrating the [Mobiscroll](https://mobiscroll.com/) UI component library into JavaScript projects. It handles npm authentication, package installation, and framework-specific configuration files.

**Main commands:**
- `mobiscroll config <type>` — installs Mobiscroll packages and configures the project
- `mobiscroll login` / `logout` — manages credentials in `.npmrc` / `.yarnrc.yml`
- `mobiscroll start <type> [name]` — clones a Mobiscroll starter/demo project

**Supported framework types:** `angular`, `ionic`, `react`, `vue`, `jquery`, `javascript`

---

## Tech Stack

- **Runtime:** Node.js (plain JavaScript, no TypeScript, ES6 target)
- **CLI parsing:** `commander` ^2.19.0
- **Interactive prompts:** `inquirer` ^8.1.0
- **HTTP:** `axios` 1.13.6 (Mobiscroll API calls)
- **Terminal output:** `chalk` ^2.4.1, `figlet` ^1.2.1, `terminal-link` ^1.2.0
- **File utilities:** `ncp` ^2.0.0 (recursive copy), `js-yaml` ^4.1.0
- **Versioning:** `semver` ^6.3.0
- **Lint:** ESLint with `eslint:recommended`, no-console allowed

---

## Repository Layout

```
mobiscroll-cli/
├── mobiscroll.js              # Entry point — all command definitions, option handlers, checkUpdate
├── package.json
├── src/
│   ├── utils.js               # Core helpers: run(), installMobiscroll(), API calls, file I/O, package manager detection
│   ├── configAngular.js       # Angular-specific: app.module.ts, angular.json, SCSS, standalone components
│   ├── configIonic.js         # Ionic variants: Angular/React/Vue, lazy loading, CSS copy scripts
│   ├── helperMessages.js      # Per-framework usage instructions printed after config
│   └── npm-login/             # Custom npm login (index.js, login.js, adduser.js)
├── resources/                 # Template files copied into user projects
│   ├── angular/, ionic/, react/, vue/, javascript/, jquery/
│   └── ionic/scripts/copy-mobiscroll-css.js
├── scripts/
│   └── normalize-line-endings.js   # Converts CRLF → LF before publish
└── tests/
    └── integration/
        └── test-install-commands.js  # 60+ scenario matrix for installMobiscroll()
```

---

## Development Workflow

```bash
# Install dependencies
npm install

# Run the CLI directly (development)
node mobiscroll.js config angular

# Install globally for end-to-end testing
npm install -g .
mobiscroll config angular

# Run integration tests
node tests/integration/test-install-commands.js

# Publish (normalizes line endings first via prepublish hook)
npm publish
```

Before publishing: bump the version in `package.json` and update `changelog.txt`.

---

## Architecture & Key Patterns

### Command flow

1. `mobiscroll.js` parses flags with `commander`, sets module-level variables (`isTrial`, `isLite`, `useScss`, `proxyUrl`, etc.)
2. For `config`, it calls `utils.checkMbscNpmLogin()` to verify credentials, then calls the top-level `config()` function
3. `config()` dispatches to `configAngular()`, `configIonic()`, or prints `helperMessages` for React/Vue/jQuery/JS
4. Framework config functions call `utils.installMobiscroll()` to build and run the npm/yarn/pnpm install command, then modify project files

### Key functions in `src/utils.js`

| Function | Purpose |
|---|---|
| `run(cmd, silent, returnOutput, ignoreError)` | Wraps `child_process.exec` as a Promise |
| `installMobiscroll(settings, callback)` | Builds the full install command string, runs it |
| `checkMbscNpmLogin(...)` | Verifies auth token via Mobiscroll API, prompts login if needed |
| `findMonorepoRoot(dir)` | Traverses up to 5 levels looking for workspace root |
| `testPnpm(dir)` / `testYarn(dir)` | Detects package manager from lock files |
| `getMainAngularVersion(packageJson)` | Returns major Angular version from dependencies |
| `getSassLoader(packageJson)` | Returns `{ syntax: '@import'|'@use' }` based on sass version |
| `updateAuthTokenInYarnrc(dir, remove)` | Syncs `.npmrc` auth token into `.yarnrc.yml` |
| `printFeedback` / `printWarning` / `printError` / `printLog` | Colored console output helpers |

### Settings object

The `settings` object passed through `config()` → `configAngular()` / `configIonic()` contains:

```js
{
  projectType,       // 'angular' | 'ionic' | 'react' | ...
  currDir,           // absolute path to user's project root
  packageJson,       // parsed package.json of user's project
  packageJsonLocation,
  userName,          // Mobiscroll account username
  useTrial,          // boolean
  isLite,            // boolean
  isNpmSource,       // false = skip npm install, just print instructions
  useScss,           // true | false | undefined (undefined = prompt user)
  mobiscrollVersion, // semver string or null (null = latest)
  proxyUrl,
  apiKey,
  isIonicApp,        // set by configAngular for Ionic+Angular
  isLazy,            // Ionic lazy loading
  package,           // package type hint for start command
}
```

---

## Package Naming (v5 vs v6)

This is the trickiest part of the codebase. Package names differ by version:

| Version | Angular package | React package |
|---|---|---|
| v6+ (current) | `@mobiscroll/angular` (npm alias to `-legacy`) | `@mobiscroll/react` |
| v5 Ivy | `@mobiscroll/angular-ivy` | `@mobiscroll/react-next` |
| v5 non-Ivy | `@mobiscroll/angular` | `@mobiscroll/react` |

For v6+, npm aliases are used:
```
@mobiscroll/angular@npm:@mobiscroll/angular-legacy@<version>
```

The `installMobiscroll()` function in `src/utils.js` contains the full branching logic for building install commands. The integration tests in `tests/integration/test-install-commands.js` cover all combinations — always run them after touching install logic.

---

## Package Manager Detection

The CLI auto-detects the package manager from lock files (checked at monorepo root if applicable):

- `pnpm-lock.yaml` → pnpm
- `yarn.lock` → yarn (v1 or v2+)
- Otherwise → npm

Yarn v2+ uses `.yarnrc.yml` instead of `.npmrc`. The CLI syncs the auth token into `.yarnrc.yml` automatically whenever it writes to `.npmrc`.

---

## Adding Support for a New Framework

1. Add the new type string to the `config()` switch in `mobiscroll.js`
2. Add install command logic in `src/utils.js` → `installMobiscroll()` (follow existing v5/v6 branching)
3. Add helper message output in `src/helperMessages.js`
4. Add resource templates to `resources/<framework>/` if needed
5. Add test cases to `tests/integration/test-install-commands.js`

---

## External APIs

- **Mobiscroll API:** `https://api.mobiscroll.com/api/` — used to verify user access and get latest Mobiscroll version
- **Mobiscroll npm registry:** `https://npm.mobiscroll.com` — scoped to `@mobiscroll` packages, requires auth token in `.npmrc`

---

## Testing

The integration tests stub `child_process` and `axios` before requiring `utils.js`, then call `installMobiscroll()` directly and assert on the generated npm install command string.

```bash
node tests/integration/test-install-commands.js
```

There are no unit test files beyond this. When changing install command logic, expand the test matrix to cover the new cases.

---

## Common Gotchas

- **`process.env.HOME`** is explicitly set to `''` on Windows to fix the npm-login plugin — don't remove this line in `mobiscroll.js`.
- **Monorepo detection** traverses up 5 directory levels; lock file checks use the monorepo root, not `currDir`.
- **Standalone Angular components** (Angular 14+) skip `app.module.ts` modification; detection is via presence of `bootstrapApplication` in `main.ts`.
- **React 18+** uses a different entry point pattern; detected via React version in `package.json`.
- **`legacyPeerFlag`** adds `--legacy-peer-deps` to npm installs — exposed as `--legacy` CLI flag for projects with peer dep conflicts.
- **Line endings:** The prepublish script normalizes `mobiscroll.js` to LF. On Windows, ensure you don't accidentally commit CRLF to the entry point.

---

## Invariants

These must always hold. If a change would break one, stop and reconsider.

- **Auth token is never logged or printed.** The token from `.npmrc` is read and passed internally but must never appear in `console.log`, error messages, or feedback strings.
- **`process.exit()` is only called from `printError()` or after a deliberate user action** (update accepted, login completed). Never call it mid-flow to handle a recoverable error.
- **`.npmrc` and `.yarnrc.yml` are always kept in sync.** Any function that writes a token to `.npmrc` must also call `updateAuthTokenInYarnrc()` if `.yarnrc.yml` exists. Any function that removes it must pass `remove=true`.
- **The `settings` object is the single source of truth for a command invocation.** Module-level variables (`isTrial`, `isLite`, etc.) in `mobiscroll.js` are set once during option parsing and then written into `settings` before being passed down — never read them directly inside `src/` files.
- **`installMobiscroll()` must never mutate the user's project files.** It only constructs and executes the install command. File modifications happen in `configAngular.js` / `configIonic.js` after the install resolves.

---

## Modification Constraints

Rules for specific areas of the codebase — break them only with a clear reason.

- **`src/utils.js` has no framework-specific logic.** Framework branching belongs in `configAngular.js`, `configIonic.js`, or `mobiscroll.js`. Utility functions must stay framework-agnostic.
- **`helperMessages.js` contains only output strings, no side effects.** Functions there must return or `console.log` only — no file writes, no `run()` calls.
- **Do not change the `commander` version** without verifying option parsing behavior. The API changed significantly between v2 and v3+; the project pins v2 intentionally.
- **Do not upgrade `inquirer` past v8.** v9+ is ESM-only and incompatible with this project's CommonJS `require()` module system. Upgrading would require migrating the entire project to ESM or introducing a bundler.
- **Do not add new module-level mutable state to `mobiscroll.js`.** Every option already has a corresponding `handle*()` function and a `var` at the top. Adding state outside this pattern creates hidden coupling.
- **Resource templates in `resources/` are copied verbatim into user projects.** Do not add Node.js `require()` calls or absolute paths there — they must work standalone.
- **Test stubs must be set up before `require('./src/utils.js')`** in test files. Utils resolves `child_process` and `axios` at load time, so stubbing after the require has no effect.

---

## Explicit Decision Rules

When making a change, apply these rules to resolve ambiguity.

**Which file handles a framework?**
- Angular → `src/configAngular.js`
- Ionic (any sub-framework) → `src/configIonic.js`
- React, Vue, jQuery, JavaScript → `helperMessages.js` only (no file modifications, just print instructions)

**Should a new flag go in `mobiscroll.js` or `utils.js`?**
- If it affects what gets installed or how: `mobiscroll.js` (sets a `handle*()` var, passed into `settings`)
- If it affects file detection/reading: `utils.js`

**v5 vs v6 install command branching:**
- Check `semver.major(mobiscrollVersion) >= 6` (or `=== 5` for legacy paths)
- v6+ uses npm aliases; v5 uses `-ivy` / `-next` suffixes — never mix the two patterns

**When to prompt vs. proceed silently:**
- Prompt the user only for destructive or irreversible choices (overwriting config files, skipping install)
- Always default to the safer/non-destructive option in the `inquirer` `default` field

**Monorepo vs. single-project paths:**
- Always call `findMonorepoRoot(currDir)` first and use its result for lock file detection
- Use `currDir` (not monorepo root) for all project file reads/writes (e.g., `package.json`, `angular.json`)

