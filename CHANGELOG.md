# Changelog

All notable changes to the Mobiscroll CLI are documented in this file. Full release notes are also published at [mobiscroll.com/releases](https://mobiscroll.com/releases#cli).

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.16.3] - 2026-05-19

### Fixed

- Updated axios package dependency to resolve npm audit warnings.

## [1.16.2] - 2026-04-02

### Fixed

- We fixed an issue where the config command, in the case of v6 packages, failed for users with date & time licenses.
- Updated package dependencies to resolve npm audit warnings.

## [1.16.1] - 2026-03-19

### Fixed

- We fixed a v6 `--no-npm` CSS path generation issue that could produce an invalid comma-separated stylesheet entry.

## [1.16.0] - 2026-03-06

### Added

- We updated the `start` command to install modern Mobiscroll demo applications, replacing the legacy v4 starters.
- We added `version` property to esm5 `package.json` in no-npm installation to support additional bundlers.
- We added support for Mobiscroll v6 packages.
- We added yarn/pnpm monorepo detection to use the correct package manager in submodules.
- We updated the SCSS configuration to use the modern `@use` syntax instead of the deprecated `@import` for Sass 1.23.0+.

### Fixed

- We corrected the `mbsc-font-path` SCSS variable in Angular 13+ applications in case of no-npm config.
- We fixed the config command for Angular 19+ applications to properly inject CSS/SCSS imports and MbscModule.
- We updated package dependencies to resolve npm audit warnings.

## [1.15.0] - 2024-05-23

### Added

- Added support for installing the new react-next package for React 18 and higher.

## [1.14.4] - 2024-02-23

### Fixed

- We improved on the angular MbscModule injection and fixed the extra trailing spaces.
- We fixed the angular style sheet loading order in the angular.json file.
- We fixed the no-npm config in case of legacy Angular View Engine packages.

## [1.14.3] - 2024-02-22

### Fixed

- We fixed an error appearing when the config command was executed in an application where the cli couldn't identify the necessary module/component files.
- We fixed the logout command which was not working in certain scenarios.
- We added the missing helper message in case of jquery and javascript config.

## [1.14.2] - 2024-01-23

### Fixed

- We fixed the package generated with the `--no-npm` flag to work with native Node.js imports.
- We fixed the documentation link for Vue.

## [1.14.1] - 2023-09-26

### Fixed

- We added missing `--legacy-peer-deps` flag in case of `no-npm` install.
- We fixed yarn support in case of the login/logout commands, the AUTH_TOKEN was not updated in the `.yarnrc.yml`.
- We fixed the logout command which was not working correctly when the npm login was used.

## [1.14.0] - 2023-09-25

### Added

- We added support for pnpm repositories.

## [1.13.0] - 2023-07-14

### Added

- We added support for team npm users to allow sharing credentials between members of the same development team.

## [1.12.0] - 2023-06-22

### Added

- We added support for Date & time picking packages from npm. The config command will handle the license type and install the appropriate package.

## [1.11.0] - 2023-06-12

### Added

- We added support for Vue, the config command will install Mobiscroll for Vue in case of Vue applications and provide usage examples.

## [1.10.1] - 2023-04-17

### Fixed

- We fixed a bug that prevented the version 4 library installation with the `--no-npm` flag in Angular projects.

## [1.10.0] - 2023-04-13

### Added

- We added support for Angular standalone components.
- We added support for Ionic 7 Angular applications which are using standalone Angular components by default.

### Fixed

- We prevented Angular Ivy package installation for previous unsupported versions.

## [1.9.0] - 2023-04-06

### Added

- We added Angular Ivy support for Angular version 13 and higher.

## [1.8.1] - 2023-04-04

### Fixed

- We fixed the yarn 2+ config where the AUTH_TOKEN was not updated in the .yarnrc.yml when a new token was generated in the .npmrc file.

## [1.8.0] - 2022-09-22

### Added

- We added the `--legacy-peer-deps` flag that will be transmitted to internally executed npm install command.

### Fixed

- We fixed the yarn 2+ config where the content of the .yarnrc.yml file was overwritten.
- We adjusted the scss import in case of Angular config to work with Angular 15.

## [1.7.3] - 2022-09-22

### Fixed

- Solved deprecation warnings by removing the npm-registry-client dependency and replaced with a local solution.
- Solved the vulnerability error by removing the git-clone dependency and replaced with a local solution.

## [1.7.2] - 2022-06-17

### Fixed

- We fixed the yarn 2+ config where on some cases the npm auth token copy from the .npmrc gave error.

## [1.7.1] - 2022-05-11

### Fixed

- We fixed the `--proxy` parameter to pass it down to the `npm` and `yarn` calls, so the config command runs, even if proxy options are not set in the npm/yarn config, or in the system environment variables.

## [1.7.0] - 2021-11-17

### Added

- We added support for yarn 2+. The cli takes the npm auth token from the .npmrc file and creates .yarnrc.yml to make sure the mobiscroll install gets authenticated.

### Fixed

- Passed down proxy url to the npm registry client
- Updated outdated packages.

## [1.6.0] - 2021-03-02

### Added

- We switched from the deprecated request library to axios for the internal requests.
- We added esm build support for the packages created with the no-npm config.

### Fixed

- We fixed the unhandled package.json error message when the CLI was not executed in the root folder of the application.
- We fixed the missing MbscModule module problem in angular apps. The module was removed when the config command was re-executed.
- We fixed the `--scss` and `--css` flags didn't remove the previous style import.
- We fixed the v5 angular config which always loaded the css even if the scss option was selected.
- We fixed the update process which was exiting in case of an unsuccessful update.

## [1.5.8] - 2020-12-03

### Added

- We improved on the version flag and added support for v5 trial installation. Besides semver versions now it is possible to pass main version to the flag and it will install the latest package from the passed version.

## [1.5.7] - 2020-11-20

### Fixed

- We fixed series of error messages which occurred when the package.json didn't have dependencies property.
- We prevented the error which occurred if the npm-cli install didn't return the package with the installed version.

## [1.5.6] - 2020-07-01

### Fixed

- We fixed the start command which was incorrectly detecting the user's license.

## [1.5.5] - 2020-07-01

### Fixed

- We fixed the scss font path variable in case of angular 10 and no-npm config. It pointed to a wrong path.

## [1.5.4] - 2020-06-25

### Fixed

- We fixed and improved on the warning message which is appearing when the user doesn't have an appropriate license to install mobiscroll from npm.

## [1.5.3] - 2020-06-16

### Fixed

- We fixed the angular module detection in case of an Ionic 5 apps. It only displayed the routing modules of the pages.

## [1.5.2] - 2020-05-04

### Fixed

- We fixed a bug which was present in the no-npm config with sass stylesheet. An angular specific replace in the scss was applied to other frameworks and it caused problems.

## [1.5.1] - 2020-04-20

### Fixed

- We changed the way new version availability was checked. Starting from this release only stable versions will be installed by default. You can install a beta version with the help of the `--version` flag.
- We fixed a version check regex problem which lead to an error if beta version was installed.

## [1.5.0] - 2020-04-17

### Added

- Added compatibility with Mobiscroll version 5.

### Fixed

- `--scss` flag was not working if the project was already configured with css.
- no-npm config didn't complete the package generation if yarn was used.

## [1.4.0] - 2020-02-25

### Added

- start command now supports ionic-react app.
- start ionic-angular command now installs Ionic v5 based app. For starting an Ionic 4 based app use `--ionic-version=4` flag.

### Fixed

- config ionic command duplicated mobiscroll imports in react apps.

## [1.3.5] - 2020-02-04

### Fixed

- config angular gave an error with older angular cli apps. The command searched for a `style.scss` file even if the app didn't have scss config.
- Improved angular config feedback messages.

## [1.3.4] - 2020-01-22

### Fixed

- Error occurred when scss stylesheet was selected in Angular CLI app and it wasn't configured with only css. It gave the following error: `no such file or directory, open '..\ngapp\src\styles.scss'`.
- `yarn` detection was improved, it didn't detect correctly if the yarn is installed on system.
- Angular `rxjs-compat` package detection on osx.

## [1.3.3] - 2020-01-07

### Fixed

- Ionic 3 no-npm config was crashing. It gave the following error: `TypeError: Cannot read property 'dependencies' of undefined`.

## [1.3.2] - 2020-01-06

### Fixed

- Ionic 3 config was crashing. It gave the following error: `no such file or directory, open '...global.scss'`.

## [1.3.1] - 2019-12-16

### Fixed

- Previously configured css/scss versions wasn't detected by the config command in case of angular-cli based apps.
- Mobiscroll js and css file detection was not correct in case of no-npm config.
- Get rid of `UnhandledPromiseRejectionWarning` node warnings.
- no-npm config update grabbed older package instead of the newly generated one.
- modified angular config to do not replace modules which are already present in the module file.

## [1.3.0] - 2019-11-27

### Fixed

- Angular `--no-npm` includes the esm5 file in the generated package, required by Ivy.

## [1.2.1] - 2019-09-30

### Fixed

- Angular `--no-npm` config version check error

## [1.2.0] - 2019-09-27

### Added

- Angular config won't install rxjs-compat package starting form Mobiscroll v4.8.2.
- Config command will install the trial version if the user has a different or old license.

## [1.1.0] - 2019-08-14

### Added

- Config ionic command now supports ionic react based applications.

### Fixed

- Exit configuration process if the command is not executed on the root folder of the application.

## [1.0.0] - 2019-07-04

### Added

- Added `--css` flag to force css style config
- Ionic config detects previously used style type. It can be override with the `--css` and `--scss` flags.

## [0.10.3] - 2019-06-12

### Fixed

- Ionic 3 config font loading errors in case of scss style.

## [0.10.2] - 2019-06-04

### Fixed

- Older angular cli config `not a directory` error.

## [0.10.1] - 2019-05-28

### Fixed

- Changing config from css to scss improvements and fixes.

## [0.10.0] - 2019-05-17

### Added

- Added scss config support.

## [0.9.2] - 2019-03-26

### Fixed

- --no-npm install package caching problem with yarn.

## [0.9.1] - 2019-03-20

### Added

- Detect yarn and use it's commands where the project was configured with it.
- Improved no access to package feedback message.

## [0.9.0] - 2019-03-14

### Added

- Improved failed npm install feedback messages.
- Reduced async operations.

## [0.8.9] - 2018-11-13

### Added

- New proxy flag where the user can define a proxy URL which will be passed to the internal requests.

### Fixed

- Updated package versions. Older inquirer(v3.x) was not working with newer node versions.

## [0.8.8] - 2018-10-10

### Fixed

- config angular --no-npm wasn't clearing unused files.

## [0.8.7] - 2018-09-20

### Fixed

- config angular errors during the stylesheet configuration. (The angular-cli modified the structure of it's angular.json config file. Added support for both of the configurations).

## [0.8.6] - 2018-09-11

### Added

- Copying font files to the public folder in case of meteor app. Fixed angular typescript check which was giving error if no devDependencies were found in the package.json.

## [0.8.5] - 2018-08-14

### Added

- Support for ionic 4 based app.

## [0.8.4] - 2018-08-13

### Fixed

- Trial version of angular config.

## [0.8.3] - 2018-08-03

### Added

- Added angular and react project support for start command.

### Fixed

- Add feedback message when Logout command didn't find .npmrc file.

## [0.8.2] - 2018-08-03

### Fixed

- Ionic 3 config css link.

## [0.8.0] - 2018-08-02

### Added

- Support for ionic 4 based app.

### Fixed

- no-npm install fixes.

## [0.7.1] - 2018-07-19

### Added

- Print warning on unknown command.

### Fixed

- `-v`(version) flag.

## [0.7.0] - 2018-07-19

### Added

- `start` command for creating starter apps.

## [0.6.4] - 2018-07-11

### Added

- Modified --no-npm version info. It is read from the local file instead of an API call.

### Fixed

- Typo fixes.
- React install instruction fixes.
- no-npm remove unused file fixes.

## [0.6.3] - 2018-07-09

### Added

- Handle non angular-cli based config angular installs.

## [0.6.2] - 2018-07-04

### Fixed

- Modified http links to https.

## [0.6.1] - 2018-06-22

### Fixed

- Fix mobiscroll logout command.

## [0.6.0] - 2018-06-20

### Added

- .npmrc file will be generated in the working directory by default and added --global flag to modify this.
- config commad new --version flag.
- Print warnings if the config ionic command is used in older ionic projects.

## [0.5.1] - 2018-05-14

### Added

- Added angular cli v6 support.

### Fixed

- Updated getApiKey request, used request.get instead of http.get.

## [0.5.0] - 2018-03-29

### Added

- Unified trial & package names.
- config angular command installs rxjs-compat package.

## [0.4.8] - 2018-03-05

### Fixed

- angular config lite/trial old lite replace fix.
- Normalizing line endings.

## [0.4.4] - 2018-02-21

### Fixed

- Trial config fix.
- no-npm support errors.

## [0.4.0] - 2018-02-12

### Added

- Added support for `react`, `javascript`, `jquery`, `angularjs` config.

## [0.3.1] - 2018-01-17

### Added

- Added separate help for the config command.

### Fixed

- Added description for lazy flag.
- ionic-pro command error.

## [0.3.0] - 2017-12-21

### Added

- Add `ionic-pro` command to config
- Added `--lazy` flag
- Use local npm-login instead of git and removed assets copy from copy script.

## [0.2.2] - 2017-12-11

### Added

- Remove trial/nontrial packages from package.json if the other version is installed.

### Fixed

- Removed harmony flag for fixing compatibility problems.

## [0.2.1] - 2017-10-05

### Added

- config command ask for email and username.

## [0.2.0] - 2017-10-04

### Added

- angular configuration.

## [0.1.4] - 2017-10-02

### Fixed

- npm install error message improvements.

## [0.1.3] - 2017-09-29

### Fixed

- npm login/logout issues.

## [0.1.2] - 2017-09-29

### Added

- npm login/logout support.

## [0.1.1] - 2017-09-28

### Added

- Error message improvements.

## [0.1.0] - 2017-09-27

### Added

- Introducing Mobiscroll CLI with ionic configuration tool.
