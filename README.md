# Mobiscroll CLI

[![npm version](https://img.shields.io/npm/v/@mobiscroll/cli.svg)](https://www.npmjs.com/package/@mobiscroll/cli)
[![license](https://img.shields.io/npm/l/@mobiscroll/cli.svg)](./LICENSE)

A command-line tool for installing and configuring [Mobiscroll UI](https://mobiscroll.com/) components in your project. It's for Mobiscroll UI only: Mobiscroll Connect (server-side calendar sync) has its own SDKs and doesn't use the CLI.

## What is it?

The Mobiscroll CLI automates the setup work that would otherwise be done by hand: authenticating with the Mobiscroll npm registry, installing the right package for your framework and license, and wiring up framework-specific configuration (module imports, `angular.json`, stylesheets, etc.).

It supports:

- **Angular**
- **Ionic** (Angular, React, or Vue)
- **React**
- **Vue** 3+
- **JavaScript**
- **jQuery**

## Installation

```bash
npm install -g @mobiscroll/cli
```

## Usage

```bash
mobiscroll config <type>
```

Installs and configures Mobiscroll UI for the given framework (`angular`, `ionic`, `react`, `vue`, `jquery`, or `javascript`) in the current project.

If you're not signed in, the command signs you in first: it prints a sign-in link and a code; press Enter to open the link in your browser, and approve. On another device, open `mobiscroll.com/device` and type the code. Without a license, the CLI installs the trial; when your license doesn't cover the framework, it asks first (with `--yes` it installs it right away). After a trial install, it tells you whether your account's trial works: if you haven't started one, it links the page that starts it; if it has ended, how to extend it.

```bash
mobiscroll login
mobiscroll logout
```

Signs you in to the Mobiscroll npm registry, or signs you out. Each sign-in creates a token in the project's `.npmrc` (or the global one with `-g`). Tokens don't expire: see and cancel them at [mobiscroll.com/account/tokens](https://mobiscroll.com/account/tokens). `mobiscroll logout` also cancels your token. To sign in with your user name and password (or the team npm user secret) in the terminal instead of the browser, add `--password`. If you commit the project's `.npmrc`, installs work for everyone out of the box, but anyone who can read the repository can use the token; for other setups see [Using the npm auth token securely](https://mobiscroll.com/docs/javascript/guides/npm-auth-token). With `-g`, the CLI doesn't touch the project's `.npmrc`; if that file has a token, npm keeps using it, and the CLI warns you.

```bash
mobiscroll start <type> <name>
```

Clones a Mobiscroll UI demo project to get you up and running quickly.

## AI agents and CI

An AI agent can't approve a sign-in. It runs:

```bash
mobiscroll config <type> --yes --no-wait
```

The command prints a sign-in link and a code, then stops. The agent shows both to you, you approve in your browser, and the agent runs the same command again (within 10 minutes). The agent never approves the sign-in itself, never asks for your password and never runs `npm login`. If the CLI prints a note or warning about the token or the trial, the agent shows it to you. `--yes` never asks a question; it's automatic when there is no terminal.

A CI pipeline doesn't run the sign-in: nobody is there to approve it. Sign in once, store your token in a CI secret and reference it from `.npmrc`, as described in [Using the npm auth token securely](https://mobiscroll.com/docs/javascript/guides/npm-auth-token). An AI agent working without a browser, for example in a cloud sandbox, still uses the command above: you approve on your own device.

## Reference

For the full command and flag reference, run:

```bash
mobiscroll --help
```

or visit the [CLI docs page](https://mobiscroll.com/docs/javascript/core-concepts/cli).

## License

Apache-2.0
