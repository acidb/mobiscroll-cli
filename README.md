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

```bash
mobiscroll login
mobiscroll logout
```

Manages your Mobiscroll npm registry credentials.

```bash
mobiscroll start <type> [name]
```

Clones a Mobiscroll demo project to get you up and running quickly.

For the full command and flag reference, run:

```bash
mobiscroll --help
```

or visit the [CLI docs page](https://mobiscroll.com/docs/core-concepts/cli).

## License

Apache-2.0
