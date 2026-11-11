# Mobiscroll CLI

[![npm version](https://img.shields.io/npm/v/@mobiscroll/cli.svg)](https://www.npmjs.com/package/@mobiscroll/cli)
[![license](https://img.shields.io/npm/l/@mobiscroll/cli.svg)](./LICENSE)

A command-line tool for installing and configuring [Mobiscroll](https://mobiscroll.com/) UI components in your project.

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

Installs and configures Mobiscroll for the given framework (`angular`, `ionic`, `react`, `vue`, `jquery`, or `javascript`) in the current project.

If you're not signed in, the command signs you in first: it opens a sign-in page in your browser, where you approve. On another device, open `mobiscroll.com/device` and type the code shown in the terminal. Without a license, the CLI installs the trial.

```bash
mobiscroll login
mobiscroll logout
```

Signs you in to the Mobiscroll npm registry, or signs you out. Each sign-in creates a token in the project's `.npmrc` (or the global one with `-g`). Tokens don't expire: see and cancel them at [mobiscroll.com/account/tokens](https://mobiscroll.com/account/tokens). `mobiscroll logout` also cancels your token. To sign in with your user name and password (or the team npm user secret) in the terminal instead of the browser, add `--password`.

```bash
mobiscroll start <type> [name]
```

Clones a Mobiscroll demo project to get you up and running quickly.

## AI agents and CI

An AI agent can't approve a sign-in. It runs:

```bash
mobiscroll config <type> --yes --no-wait
```

The command prints a sign-in link and a code, then stops. The agent shows both to you, you approve in your browser, and the agent runs the same command again (within 10 minutes). The agent never approves the sign-in itself and never asks for your password. `--yes` never asks a question; it's automatic when there is no terminal.

In CI there is no browser and no terminal, so the CLI can't sign in. Store a token in a CI secret and reference it from `.npmrc`, as described in [Using the npm auth token securely](https://mobiscroll.com/docs/react/guides/npm-auth-token).

## Reference

For the full command and flag reference, run:

```bash
mobiscroll --help
```

or visit the [CLI docs page](https://mobiscroll.com/docs/core-concepts/cli).

## License

Apache-2.0
