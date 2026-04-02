const fs = require('fs');
const chalk = require('chalk');
const exec = require('child_process').exec;
const execSync = require('child_process').execSync;
const mbscNpmUrl = 'https://npm.mobiscroll.com';
const mbscApiUrlBase = 'https://api.mobiscroll.com';
const dataRowRegex = /\/\/npm.mobiscroll.com\/:_authToken=(.*)/im;
const terminalLink = require('terminal-link');
const inquirer = require('inquirer');
const path = require('path');
const npmLogin = require('./npm-login/');
const helperMessages = require('./helperMessages.js');
const ncp = require('ncp').ncp;
const axios = require('axios');
var semver = require('semver');
const yaml = require('js-yaml');
const os = require('os');

function processProxyUrl(url) {
  const proxyObj = {};
  let proxyParts = [];

  if (url.indexOf('@') === -1) {
    proxyParts = url.replace('//', '').split(':');
    proxyObj.protocol = proxyParts[0];
    proxyObj.host = proxyParts[1];

    if (proxyParts.length > 2) {
      proxyObj.port = proxyParts[2];
    }
  } else {
    proxyParts = url.split('@');
    const proxyAuth = proxyParts[0].replace('//', '').split(':');
    const proxyHost = proxyParts[1].split(':');

    proxyObj.protocol = proxyAuth[0];
    proxyObj.host = proxyHost[0];

    if (proxyHost.length > 1) {
      proxyObj.port = proxyHost[1];
    }

    if (proxyAuth.length >= 3) {
      proxyObj.auth = {
        username: proxyAuth[1],
        password: proxyAuth[2],
      };
    }
  }

  return proxyObj;
}

function printNpmWarning(warning, text) {
  console.log('\nnpm ' + chalk.bgYellow.black('WARN') + ' ' + chalk.magenta(warning || '') + ' ' + chalk.bold.yellow(text));
}

function printWarning(text) {
  console.log('\n' + chalk.bold.yellow(text));
}

function printError(text) {
  console.log('\n' + chalk.bold.red(text) + chalk.magenta('\nIf the problem persists get in touch at support@mobiscroll.com'));
  process.exit();
}

function printFeedback(text) {
  console.log('\n' + chalk.bold.cyan(text));
}

function printLog(text) {
  console.log(`${chalk.green('>')} ` + text + '\n');
}

function testPnpm(currDir) {
  // Check if we're in a monorepo submodule and use the root's lock file
  const checkDir = findMonorepoRoot(currDir) || currDir;
  const hasLockFile = fs.existsSync(path.resolve(checkDir, 'pnpm-lock.yaml'));
  return hasLockFile;
}

function testYarn(currDir) {
  // Check if we're in a monorepo submodule and use the root's lock file
  const checkDir = findMonorepoRoot(currDir) || currDir;
  const hasLockFile = fs.existsSync(path.resolve(checkDir, 'yarn.lock'));
  const yarnVersion = runCommandSync('yarn -v', true);
  if (yarnVersion && hasLockFile) {
    return yarnVersion;
  }
  return false;
}

function runCommand(cmd, skipWarning, skipError, skipLog) {
  if (!skipLog) {
    console.log(`${chalk.green('>')} ${cmd}`);
  }
  return new Promise((resolve, reject) => {
    exec(cmd, function (error, stdout, stderr) {
      if (stderr && !skipError && !skipWarning) {
        printWarning(
          'There was an stderror during executing the following command ' +
          chalk.gray(cmd) +
          '. \n\nHere is the warning message: \n\n' +
          stderr
        );
      }
      if (error && !skipError) {
        //printError('Could not run command ' + chalk.gray(cmd) + '. \n\n' + error);
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}

function runCommandSync(cmd, skipError) {
  try {
    return execSync(cmd, { stdio: 'pipe' }).toString('utf8');
  } catch (error) {
    if (!skipError) {
      console.log('Could not run command ' + chalk.gray(cmd) + '. \n\n' + error);
    }
  }
}

function writeToFile(location, data, callback) {
  if (data) {
    try {
      fs.writeFileSync(location, data);

      if (callback) {
        callback(null, true);
      }
    } catch (err) {
      printError('Could not write to file ' + chalk.gray(location) + '. \n\n' + err);
      callback(err);
    }
  }
}

function appendContentToFile(location, newData, replaceRegex, prepend, skipRegex, callback) {
  try {
    let fileData = fs.readFileSync(location).toString();
    if (skipRegex && skipRegex.test(fileData)) {
      if (callback) {
        callback(null);
      }
    } else {
      if (fileData && replaceRegex && replaceRegex.test(fileData)) {
        fileData = fileData.replace(replaceRegex, newData);
        writeToFile(location, fileData, callback);
      } else if (fileData && fileData.indexOf(newData) == -1) {
        writeToFile(location, prepend ? newData + '\r\n' + fileData : fileData + '\r\n' + newData, callback);
      } else if (callback) {
        callback(null);
      }
    }
  } catch (err) {
    printError('Could append to file ' + chalk.gray(location) + '. \n\n' + err);
  }
}

function importModule(moduleName, location, data, isStandalone) {
  if (data.indexOf(moduleName) === -1) {
    // check if module is not loaded
    data = 'import { ' + moduleName + " } from '" + location + "';\n" + data;
    data = data.replace('imports: [', 'imports: [' + (isStandalone ? moduleName + ', ' : '\n    ' + moduleName + ','));
  }
  return data;
}

function getMobiscrollVersion(proxy, version, callback) {
  var requestOptions = {
    url: mbscApiUrlBase + '/api/getmobiscrollversion' + (version ? '/' + version : ''),
  };

  if (proxy) {
    requestOptions.proxy = processProxyUrl(proxy);
  }

  axios(requestOptions)
    .then((resp) => {
      callback(resp.data.Version);
    })
    .catch((err) => {
      printError('Could not get mobiscroll version. Please see the error message for more information: ' + err);
    });
}

function shapeVersionToArray(version) {
  if (version === undefined) {
    return [];
  }

  return version.split('.').map((x) => {
    return +x.replace(/[^\d]/, '');
  });
}

function deleteFolderRecursive(path) {
  if (fs.existsSync(path)) {
    try {
      fs.readdirSync(path).forEach(function (file) {
        var curPath = path + '/' + file;
        if (fs.lstatSync(curPath).isDirectory()) {
          deleteFolderRecursive(curPath);
        } else {
          // delete file
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(path);
    } catch (err) {
      console.log(`Couldn't remove the ${path} folder. Error: ` + err);
    }
  }
}

function getApiKey(userName, proxy, framework, callback) {
  var requestOptions = {
    url: mbscApiUrlBase + '/api/access/' + userName + '/' + framework,
    // json: true,
    headers: {
      'User-Agent': 'request',
    },
  };

  if (proxy) {
    requestOptions.proxy = processProxyUrl(proxy);
  }

  axios(requestOptions)
    .then((resp) => {
      // pass the userName through the data
      resp.data.userName = userName;
      callback(resp.data);
    })
    .catch((err) => {
      printError(
        `There was an error during getting the user's trial code. Status: ${err.response && err.response.status
        }, User: ${userName}. \nPlease see the error message for more information: ` + err
      );
    });
}

function checkMeteor(packageJson, currDir, framework) {
  if (packageJson['meteor']) {
    console.log('\nMeteor based application detected...\n');
    let publicDir = path.resolve(currDir, 'public'),
      nodeDir = path.resolve(currDir, 'node_modules', '@mobiscroll', framework, 'dist', 'css');

    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir);
    }

    if (fs.existsSync(nodeDir)) {
      printLog('Copying font files to the public folder.');
      ncp(nodeDir, publicDir, (err) => {
        if (err) {
          printError("Couldn't copy font files to the public folder: " + err);
        }
      });
    } else {
      printLog('No font files found. Skipping copy...');
    }
  }
}

function checkAngularStandaloneComponent(settings) {
  const currDir = settings.currDir;
  const mainTsPath = path.join(currDir, 'src', 'main.ts');
  
  if (fs.existsSync(mainTsPath)) {
    const content = fs.readFileSync(mainTsPath, 'utf-8');
    
    // Standalone apps use bootstrapApplication
    // Module-based apps use platformBrowserDynamic().bootstrapModule
    if (content.includes('bootstrapApplication')) {
      return true;
    }
    
    if (content.includes('bootstrapModule') || content.includes('platformBrowserDynamic')) {
      return false;
    }
  }
  
  // Fallback: check app.component.ts for standalone: true
  const appComponentPath = path.join(currDir, 'src', 'app', 'app.component.ts');
  if (fs.existsSync(appComponentPath)) {
    const componentContent = fs.readFileSync(appComponentPath, 'utf-8');
    return componentContent.includes('standalone: true');
  }
  
  // Default to false if uncertain
  return false;
}

function updateAuthTokenInYarnrc(currDir, deleteToken) {
  // in case of yarn2 we need to copy the auth token form the .npmrc file to the .yarnrc.yml
  let data;
  const npmrcPath = path.resolve(currDir, '.npmrc');
  const ymlPath = path.resolve(currDir, '.yarnrc.yml');

  try {
    if (fs.existsSync(ymlPath)) {
      const ymlFile = fs.readFileSync(ymlPath, 'utf8');
      data = yaml.load(ymlFile);
    }
    const isTokenAvailable = data && data.npmScopes && data.npmScopes.mobiscroll && data.npmScopes.mobiscroll.npmAuthToken;
    const isNpmrcAvailable = fs.existsSync(npmrcPath);

    // update the yarnrc.yml with the aut token
    if (!deleteToken && (!isTokenAvailable || isNpmrcAvailable)) {
      // if no mobiscroll token is available, then get it form the .npmrc file and update/create the .yarnrc.yml with the necessary settings
      printLog('Updating .yarnrc.yml file with npm auth token');
      let AUTH_TOKEN = '';
      data = data || {};
      if (isNpmrcAvailable) {
        const npmrcData = fs.readFileSync(npmrcPath, 'utf8').toString();
        const tokenRow = npmrcData.match(dataRowRegex);

        if (tokenRow && tokenRow.length > 1) {
          AUTH_TOKEN = tokenRow[1];
        }
      }

      if (!data.npmScopes) {
        data.npmScopes = {};
      }

      if (!data.npmScopes.mobiscroll) {
        data.npmScopes.mobiscroll = {};
      }

      data.npmScopes.mobiscroll.npmRegistryServer = mbscNpmUrl;
      data.npmScopes.mobiscroll.npmAuthToken = AUTH_TOKEN;
      fs.writeFileSync(ymlPath, yaml.dump(data));
    }

    // remove mobiscroll auth token from the yarnrc.yml
    if (deleteToken && isTokenAvailable) {
      delete data.npmScopes.mobiscroll;
      if (Object.keys(data.npmScopes).length === 0) {
        delete data.npmScopes;
      }
      fs.writeFileSync(ymlPath, yaml.dump(data));
      printLog('Removing npm auth token from .yarnrc.yml file');
    }
  } catch (err) {
    printError("Couldn't copy the npm auth token from the .npmrc to the .yarnrc.yml file. \n\nHere is the error message:\n\n" + err);
  }
}

function login(useGlobalNpmrc, proxy) {
  // input questions
  var questions = [
    {
      type: 'input',
      name: 'username',
      message: 'Mobiscroll email or user name:',
      validate: function validateName(name) {
        return name !== '';
      },
    },
    {
      type: 'password',
      name: 'password',
      mask: '*',
      message: 'Mobiscroll password/secret:',
      validate: function validatePassword(passw) {
        return passw !== '';
      },
    },
  ];

  return new Promise((resolve, reject) => {
    inquirer
      .prompt(questions)
      .then((answers) => {
        // Email address is not used by the Mobiscroll NPM registry
        npmLogin(
          answers.username,
          answers.password,
          'any@any.com',
          mbscNpmUrl,
          '@mobiscroll',
          null,
          useGlobalNpmrc ? undefined : path.resolve(process.cwd(), '.npmrc'),
          proxy && processProxyUrl(proxy)
        )
          .then(() => {
            console.log(`  Logged in as ${answers.username}`);
            printFeedback('Successful login!\n');
            const currDir = useGlobalNpmrc ? os.homedir() : process.cwd();
            const usePnpm = testPnpm(currDir);
            const useYarn = !usePnpm && testYarn(currDir);

            if (useYarn && semver.gte(useYarn, '2.0.0')) {
              updateAuthTokenInYarnrc(currDir);
            }
            resolve(answers.username);
          })
          .catch((error) => {
            const err = error.message;
            if (
              err.indexOf('Could not find user with the specified username or password') !== -1 ||
              err.indexOf('Incorrect username or password') !== -1
            ) {
              printWarning(
                `We couldn’t log you in. This might be either because your account does not exist or you mistyped your login information. You can update your credentials ` +
                terminalLink('from your account', 'https://mobiscroll.com/account') +
                '.'
              );
              printWarning(`If you don’t have an account yet, you can start a free trial from https://mobiscroll.com/starttrial`);
              console.log(`${chalk.magenta('\nIf the problem persists get in touch at support@mobiscroll.com.')}`);
              process.exit();
            }

            printError('npm login failed.\n\n' + err);
            reject(err);
          });
      })
      .catch((err) => {
        reject(err);
      });
  });
}

function getMainAngularVersion(packageJson) {
  const angularVersionRaw = packageJson.dependencies['@angular/core'];
  const angularVersionArr = shapeVersionToArray(angularVersionRaw);
  return angularVersionArr[0];
}

function getPackageVersion(packageJson, packageName, currDir) {
  const dependencies = packageJson && packageJson.dependencies;
  const devDependencies = packageJson && packageJson.devDependencies;

  const declaredVersion =
    (dependencies && dependencies[packageName]) ||
    (devDependencies && devDependencies[packageName]);

  if (declaredVersion) {
    return declaredVersion;
  }

  const baseDir = currDir || process.cwd();
  const installedPkgJson = path.resolve(baseDir, 'node_modules', packageName, 'package.json');

  if (fs.existsSync(installedPkgJson)) {
    try {
      const installedPkg = JSON.parse(fs.readFileSync(installedPkgJson, 'utf8'));
      return installedPkg.version || '';
    } catch (e) {
      return '';
    }
  }

  return '';
}

function getSassLoader(packageJson, currDir) {
  const nodeSassVersion = getPackageVersion(packageJson, 'node-sass', currDir);
  if (nodeSassVersion) {
    return {
      implementation: 'node-sass',
      version: nodeSassVersion,
      syntax: '@import',
    };
  }

  const sassVersion = getPackageVersion(packageJson, 'sass', currDir);
  const sassSemver = sassVersion && semver.coerce(sassVersion);
  const shouldUseImport = sassSemver && semver.lt(sassSemver, '1.23.0');

  return {
    implementation: sassVersion ? 'sass' : '',
    version: sassVersion || '',
    syntax: shouldUseImport ? '@import' : '@use',
  };
}

function getScssLoadStatement(packageJson, stylesheetPath, currDir) {
  return `${getSassLoader(packageJson, currDir).syntax} "${stylesheetPath}";`;
}

function findMonorepoRoot(currDir) {
  const maxLevels = 5;
  let currentDir = currDir || process.cwd();
  
  for (let i = 0; i < maxLevels; i++) {
    // Check for npm/yarn workspaces
    const pkgJsonPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        if (pkg.workspaces) {
          return currentDir;
        }
      } catch (e) {
        // Continue searching
      }
    }
    
    // Check for pnpm root markers
    if (
      fs.existsSync(path.join(currentDir, 'pnpm-workspace.yaml')) ||
      fs.existsSync(path.join(currentDir, 'pnpm-lock.yaml'))
    ) {
      return currentDir;
    }
    
    // Move up one level
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached filesystem root
      break;
    }
    currentDir = parentDir;
  }
  
  return null;
}

module.exports = {
  checkTypescriptVersion: (packageJson) => {
    var version = (packageJson.devDependencies ? packageJson.devDependencies.typescript : '') || packageJson.dependencies.typescript;

    var v = shapeVersionToArray(version);

    if (v[0] < 2 || (v[0] == 2 && v[1] < 2)) {
      printWarning(
        `Your app's TypeScript version is older then the minimum required version for Mobiscroll. (${version} < 2.2.0) Please update your project's Typescript version. (You can update the following way: $ npm install typescript@latest)`
      );
      return false;
    }

    if (v.length === 0) {
      printWarning(
        `No TypeScript version was found in the package.json. The TypeScript >= 2.2.0 is required for the @mobiscroll/angular package.`
      );
    }

    return true;
  },
  installMobiscrollLite: function (framework, version, callback) {
    framework = framework.indexOf('ionic') > -1 ? 'angular' : framework;
    runCommand(`npm install @mobiscroll/${framework}-lite@${version || 'latest'} --save`, true).then(() => {
      printFeedback(`The lite version of Mobiscroll for ${framework} installed.`);
      callback();
    });
  },
  removeUnusedPackages: function (framework, packageJsonLocation, isTrial, isLite, callback, noNpm) {
    framework = framework.indexOf('ionic') > -1 ? 'angular' : framework;

    var changed,
      packageName = `@mobiscroll/${framework}`,
      trialPackageName = packageName + '-trial',
      litePackageName = `@mobiscroll/${framework}-lite`,
      packageJson = JSON.parse(fs.readFileSync(packageJsonLocation, 'utf8')); // TODO: check if packageJsonLocation exists, because curently there is an ugly error

    if (noNpm) {
      // delete the mobiscroll references if it was installed from a local file system
      delete packageJson.dependencies[trialPackageName];
      delete packageJson.dependencies[packageName];
      delete packageJson.dependencies[litePackageName];
      changed = true;
    } else if (packageJson && packageJson.dependencies) {
      if (!isTrial && packageJson.dependencies[trialPackageName]) {
        changed = true;
        // Remove mobiscroll-trial package from package.json if the licenced version is installed
        delete packageJson.dependencies[trialPackageName];
      } else if (isTrial && packageJson.dependencies[packageName]) {
        changed = true;
        // Remove mobiscroll package from package.json if the trial version is installed
        delete packageJson.dependencies[packageName];
      }

      if (!isLite && packageJson.dependencies[litePackageName]) {
        changed = true;
        // delete lite package
        delete packageJson.dependencies[litePackageName];
      }
    }

    if (changed) {
      writeToFile(packageJsonLocation, JSON.stringify(packageJson, null, 4), callback);
    } else {
      callback();
    }
  },
  checkMbscNpmLogin: (isTrial, useGlobalNpmrc, proxy, framework, installVersion, callback) => {
    printFeedback('Checking logged in status...');
    // check if the user is already logged in
    runCommand('npm whoami --registry=' + mbscNpmUrl + (proxy ? ' --proxy ' + proxy : ''), false, true)
      .then(
        (userName) => {
          if (userName) {
            userName = userName.trim();
            console.log(`  Logged in as ${userName}`);
            return userName;
          }
          console.log(`  Logging in to the Mobiscroll NPM registry...`);
          return login(useGlobalNpmrc, proxy);
        },
        (err) => {
          console.log('Login error' + err);
        }
      )
      .then((userName) => {
        getApiKey(userName, proxy, framework, installHandler);

        function installHandler(data) {
          const instVersion = installVersion || data.LatestVersion;

          if (data.HasAccess === false && data.License !== '') {
            if (data.License === 'complete') {
              printWarning(
                `Looks like your maitenance agreement expired. You can check and renew your maintenance from your account at: ${chalk.gray(
                  'https://mobiscroll.com/account/licenses'
                )}`
              );
            } else {
              printWarning(
                `Looks like you don't have access to ${chalk.gray(
                  '@mobiscroll/' + framework
                )} or your maintenance agreement is expired. Make sure to double check your license and/or renew your maintenance agreement from your account: ${chalk.gray(
                  'https://mobiscroll.com/account/licenses'
                )}`
              );
            }

            if (data.License === 'component') {
              printWarning(
                `With a Component license the CLI can't install from NPM. Go to ${chalk.gray(
                  'https://download.mobiscroll.com'
                )}, manually download the package, copy it into your project and run the same command with the ${chalk.gray(
                  '--no-npm'
                )} flag.`
              );
              printWarning(`If you wish to use NPM installs, you can always upgrade to the Framework or Complete license.`);
            }

            printWarning(
              `In case there's any trouble, submit a support ticket from: ${chalk.gray('https://mobiscroll.com/account/supporttickets')}`
            );

            inquirer
              .prompt({
                type: 'input',
                name: 'confirm',
                message: `Would you like to install the trial version? (y/N)`,
                default: 'N',
              })
              .then((answer) => {
                if (answer.confirm.toLowerCase() == 'y') {
                  callback(data.userName, true, data);
                } else {
                  process.exit();
                }
              });
          } else {
            if (data.HasAccess) {
              if (!data.NpmUser && !data.NpmUserNoWarn) {
                if (data.NpmUserSet) {
                  printWarning(
                    `You are not logged in with the NPM user that was set up for your team. Please use the credentials for the NPM user.`
                  );
                  printWarning(
                    `You can check out the credentials of the NPM User on your licences page at: ${chalk.gray(
                      'https://mobiscroll.com/account/licenses'
                    )}`
                  );
                  login(useGlobalNpmrc, proxy)
                    .then((userName) => {
                      getApiKey(userName, proxy, framework, installHandler);
                    })
                    .catch((err) => console.log('Login error ' + err));
                  return;
                } else {
                  printNpmWarning(
                    'team access not set up',
                    `Looks like you don't have team NPM access configured. Please head on over to your account page to set it up: ${chalk.gray(
                      'https://mobiscroll.com/account/licenses#npm-user-setup'
                    )}\n`
                  );
                }
              }
            }
            callback(
              userName,
              data.LatestVersion && !isTrial
                ? semver.gt('3.2.4', semver.valid(instVersion) ? instVersion : semver.coerce(instVersion))
                : true,
              data
            );
          }
        }
      });
  },

  installMobiscroll: (config, callback) => {
    var framework = config.projectType,
      currDir = config.currDir,
      isTrial = config.useTrial,
      installVersion = config.mobiscrollVersion,
      proxy = config.proxyUrl,
      packageJson = config.packageJson,
      npmFlag = config.legacyPeerFlag,
      frameworkName = '',
      mainVersion;
    const package = config.package;
    const dependencies = packageJson && packageJson.dependencies;

    switch (framework) {
      case 'ionic':
        frameworkName = dependencies && dependencies['@ionic/react'] ? 'react' : dependencies['@ionic/vue'] ? 'vue' : 'angular';
        break;
      default:
        frameworkName = framework;
        break;
    }

    let isIvy = false;
    if (frameworkName === 'angular' && dependencies) {
      isIvy = getMainAngularVersion(packageJson) >= 13;
    }

    let isReactNext = false;

    if (frameworkName === 'react' && dependencies) {
      const reactVersionRaw = packageJson.dependencies['react'];
      const reactVersionArr = shapeVersionToArray(reactVersionRaw);
      isReactNext = reactVersionArr[0] >= 18;
    }

    if (!semver.valid(installVersion)) {
      mainVersion = installVersion;
    }

    getMobiscrollVersion(proxy, mainVersion, (version) => {
      const usePnpm = testPnpm(currDir);
      const useYarn = !usePnpm && testYarn(currDir);
      const isYarn2 = useYarn && semver.gte(useYarn, '2.0.0');
      if (mainVersion) {
        installVersion = version;
      }

      const packageManagerName = usePnpm ? 'pnpm' : useYarn ? `yarn (v${useYarn.trim()})` : 'npm';
      printLog(`Detected package manager: ${packageManagerName}`);

      isIvy = isIvy && semver.gte(installVersion || version, '5.23.0');
      isReactNext = isReactNext && semver.gte(installVersion || version, '5.30.0');
      const isV6 = semver.gte(installVersion || version, "6.0.0");
      // For v6+: Package name renames
      // angular-ivy -> angular (Angular 13+)
      // angular -> angular-legacy (Angular 9-12)
      // react-next -> react (React 18+)
      // react -> react-legacy (React <18)
      let suffix = '';
      if (isV6) {
        if (frameworkName === 'angular') {
          suffix = isIvy ? '' : '-legacy';
        } else if (frameworkName === 'react') {
          suffix = isReactNext ? '' : '-legacy';
        }
      } else {
        // Pre-v6: use -ivy and -next suffixes
        suffix = (isReactNext ? '-next' : '') + (isIvy ? '-ivy' : '');
      }

      let pkgName = package + suffix + (isTrial ? "-trial" : ""),
        command;

      if (isYarn2) {
        updateAuthTokenInYarnrc(currDir);
      }

      let installCmd = usePnpm ? 'pnpm add' : useYarn ? 'yarn add' : 'npm install';
      const saveFlag = isYarn2 ? '' : ' --save';
      if (isV6) {
        // v6+: normalize package modifiers away so the alias stays framework-stable.
        const baseAliasName = package.replace(/^datepicker-/, '').replace(/-trial$/, '').replace(/-legacy$/, '');
        const aliasPackageName = `@mobiscroll/${baseAliasName}`;
        const targetPackageName = `@mobiscroll/${pkgName}`;

        if (aliasPackageName === targetPackageName) {
          command = `${installCmd} ${targetPackageName}@${installVersion || version}${saveFlag}`
        } else {
          command = `${installCmd} ${aliasPackageName}@npm:${targetPackageName}@${installVersion || version}${saveFlag}`;
        }
        command =
          aliasPackageName === targetPackageName
            ? `${installCmd} ${targetPackageName}@${installVersion || version}${saveFlag}`
            : `${installCmd} ${aliasPackageName}@npm:${targetPackageName}@${installVersion || version}${saveFlag}`;
      } else {
        // Pre-v6: trial packages are still installed behind the framework package name.
        if (isTrial) {
          command = `${installCmd} @mobiscroll/${frameworkName}@npm:@mobiscroll/${pkgName}@${installVersion || version}${saveFlag}`;
        } else if (isIvy) {
          command = `${installCmd} @mobiscroll/angular@npm:@mobiscroll/${pkgName}@${installVersion || version}${saveFlag}`;
        } else if (isReactNext) {
          command = `${installCmd} @mobiscroll/react@npm:@mobiscroll/${pkgName}@${installVersion || version}${saveFlag}`;
        } else {
          command = `${installCmd} @mobiscroll/${pkgName}@${installVersion || version}${saveFlag}`;
        }
      }

      if (proxy) {
        command += ' --proxy ' + proxy;
      }

      if (npmFlag) {
        command += ' --legacy-peer-deps';
      }

      // Skip node warnings
      if (usePnpm) {
        printFeedback('Updating registry configuration for Mobiscroll...');
        runCommand('pnpm install', true)
          .then(addPackage)
          .catch((reason) => {
            printError('Could not run pnpm install.\n\n' + reason);
          });
      } else {
        addPackage();
      }
      function addPackage() {
        printFeedback(`Installing packages via ${usePnpm ? 'pnpm' : useYarn ? 'yarn' : 'npm'}...`);
        runCommand(command, true)
          .then((out) => {
            // let version = /@mobiscroll\/[a-z]+@([0-9a-z.-]+)/gmi.exec(out)[1]; // TODO handle when the npm install didn't return the package name and the version
            printFeedback(`Mobiscroll for ${framework} installed.`);
            callback(installVersion || version);
          })
          .catch((reason) => {
            printError('Could not install Mobiscroll.\n\n' + reason);
          });
      }
    });
  },
  packMobiscroll: (packLocation, currDir, framework, useYarn, version, callback) => {
    process.chdir(packLocation); // change directory to node modules folder
    console.log(`${chalk.green('>')} changed current directory to ${packLocation}. \n`);

    runCommand(`${useYarn ? 'yarn pack' : 'npm pack'}`, true).then(() => {
      // run npm pack which will generate the mobiscroll package
      fs.readdir(packLocation, function (err, files) {
        if (err) {
          printError('Could not access to the directory files.\n\n' + err);
          return;
        }
        let mbscPackage = files.filter((f) => {
          const rgx = new RegExp('mobiscroll-[a-z]+-v?' + version + '.tgz');
          return rgx.test(f);
        });

        if (mbscPackage.length) {
          // set the current directory back to the default
          process.chdir(currDir);

          callback(mbscPackage[0]);
        }
      });
    });
  },
  importModules: (moduleLocation, moduleName, mbscFileName, isStandaloneComponent) => {
    console.log(`  Adding module loading scripts to ${chalk.grey(moduleName)}`);

    // Modify *.module.ts add necessary modules
    if (fs.existsSync(moduleLocation)) {
      try {
        let data = fs.readFileSync(moduleLocation, 'utf8').toString();

        if (data.indexOf("MbscModule") === -1) {

          // Add angular module imports which are needed for mobiscroll
          data = importModule('FormsModule', '@angular/forms', data, isStandaloneComponent);
          data = importModule('MbscModule', mbscFileName, data, isStandaloneComponent); 

          writeToFile(moduleLocation, data);
        }
      } catch (err) {
        printError('There was an error during reading app.module.ts. \n\nHere is the error message:\n\n' + err);
        return;
      }
    } else {
      console.log(`  Could not find module in the following location: ${chalk.grey(moduleLocation)}`);
      return false;
    }

    return true;
  },
  deleteFolder: deleteFolderRecursive,
  npmUrl: mbscNpmUrl,
  run: runCommand,
  runSync: runCommandSync,
  writeToFile,
  shapeVersionToArray,
  getMobiscrollVersion,
  printFeedback,
  printWarning,
  printError,
  printLog,
  checkMeteor,
  login,
  testYarn,
  appendContentToFile,
  checkAngularStandaloneComponent,
  updateAuthTokenInYarnrc,
  getMainAngularVersion,
  getSassLoader,
  getScssLoadStatement,
  findMonorepoRoot
};
