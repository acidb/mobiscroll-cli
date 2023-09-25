const fs = require('fs');
const chalk = require('chalk');
const exec = require('child_process').exec;
const execSync = require('child_process').execSync;
const mbscNpmUrl = 'https://npm.mobiscroll.com';
const mbscApiUrlBase = 'https://api.mobiscroll.com';
const dataRowRegex = /\/\/npm.mobiscroll.com\/:_authToken=(.*)/mi;
const terminalLink = require('terminal-link');
const inquirer = require('inquirer');
const path = require('path');
const npmLogin = require('./npm-login/');
const helperMessages = require('./helperMessages.js');
const ncp = require('ncp').ncp;
const axios = require('axios');
var semver = require('semver');
const yaml = require('js-yaml')

function processProxyUrl(url) {
    const proxyObj = {};
    let proxyParts = [];

    if (url.indexOf('@') === -1) {
        proxyParts = url.replace('//', '').split(':');
        proxyObj.protocol = proxyParts[0];
        proxyObj.host = proxyParts[1];

        if (proxyParts.length > 2) {
            proxyObj.port = proxyParts[2]
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
                password: proxyAuth[2]
            }
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
    const hasLockFile = fs.existsSync(path.resolve(currDir, 'pnpm-lock.yaml'));
    if (hasLockFile) {
        printFeedback('Pnpm detected.')
    }
    return hasLockFile;
}

function testYarn(currDir) {
    // check if yarn command is installed and check if a yarn.lock exists in root project
    printLog('Testing yarn')
    const hasLockFile = fs.existsSync(path.resolve(currDir, 'yarn.lock'));
    const yarnVersion = runCommandSync('yarn -v', true);
    if (yarnVersion && hasLockFile) {
        printLog(`Yarn version: ${yarnVersion}`)
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
                printWarning('There was an stderror during executing the following command ' + chalk.gray(cmd) + '. \n\nHere is the warning message: \n\n' + stderr);
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
        return (execSync(cmd)).toString('utf8');
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
            callback(err)
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
    if (data.indexOf(moduleName) == -1) { // check if module is not loaded
        data = "import { " + moduleName + " } from '" + location + "';\n" + data;
        data = data.replace('imports: [', 'imports: [ ' + (isStandalone ? '' : ' \n    ') + moduleName + ', ');
    }
    return data;
}

function getMobiscrollVersion(proxy, version, callback) {
    var requestOptions = {
        url: mbscApiUrlBase + '/api/getmobiscrollversion' + (version ? ('/' + version) : '')
    }

    if (proxy) {
        requestOptions.proxy = processProxyUrl(proxy);
    }

    axios(requestOptions).then((resp) => {
        callback(resp.data.Version);
    }).catch(err => {
        printError('Could not get mobiscroll version. Please see the error message for more information: ' + err);
    });
}

function shapeVersionToArray(version) {
    if (version === undefined) {
        return [];
    }

    return version.split('.').map((x) => {
        return +x.replace(/[^\d]/, '')
    });
}

function deleteFolderRecursive(path) {
    if (fs.existsSync(path)) {
        try {
            fs.readdirSync(path).forEach(function (file) {
                var curPath = path + "/" + file;
                if (fs.lstatSync(curPath).isDirectory()) {
                    deleteFolderRecursive(curPath);
                } else { // delete file
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
            'User-Agent': 'request'
        }
    }

    if (proxy) {
        requestOptions.proxy = processProxyUrl(proxy);
    }

    axios(requestOptions).then((resp) => {
        // pass the userName through the data
        resp.data.userName = userName;
        callback(resp.data);
    }).catch(err => {
        printError(`There was an error during getting the user's trial code. Status: ${err.response && err.response.status}, User: ${userName}. \nPlease see the error message for more information: ` + err);
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
                    printError('Couldn\'t copy font files to the public folder: ' + err);
                }
            });
        } else {
            printLog('No font files found. Skipping copy...');
        }
    }
}

function checkAngularStandaloneComponent(settings) {
    const currDir = settings.currDir;
    const componentFile = path.resolve(currDir + '/src/app/app.component.ts');

    if (fs.existsSync(componentFile)) {
        let data = fs.readFileSync(componentFile, 'utf8').toString();
        const standaloneRegex = /standalone:[\s]?true/gmi;
        return standaloneRegex.test(data)
    }

    return false;
}

function login(useGlobalNpmrc, proxy) {
    // input questions
    var questions = [{
        type: 'input',
        name: 'username',
        message: 'Mobiscroll email or user name:',
        validate: function validateName(name) {
            return name !== '';
        }
    }, {
        type: 'password',
        name: 'password',
        mask: '*',
        message: 'Mobiscroll password/secret:',
        validate: function validatePassword(passw) {
            return passw !== '';
        }
    }];

    return new Promise((resolve, reject) => {
        inquirer.prompt(questions).then((answers) => {
            // Email address is not used by the Mobiscroll NPM registry
            npmLogin(answers.username, answers.password, 'any@any.com', mbscNpmUrl, '@mobiscroll', null,
                (useGlobalNpmrc ? undefined : path.resolve(process.cwd(), '.npmrc')),
                proxy && processProxyUrl(proxy)).then(() => {
                    console.log(`  Logged in as ${answers.username}`);
                    printFeedback('Successful login!\n');
                    resolve(answers.username);
                }).catch(error => {
                    const err = error.message;
                    if (err.indexOf("Could not find user with the specified username or password") !== -1 || err.indexOf("Incorrect username or password") !== -1) {
                        printWarning(`We couldn’t log you in. This might be either because your account does not exist or you mistyped your login information. You can update your credentials ` + terminalLink('from your account', 'https://mobiscroll.com/account') + '.');
                        printWarning(`If you don’t have an account yet, you can start a free trial from https://mobiscroll.com/starttrial`);
                        console.log(`${chalk.magenta('\nIf the problem persists get in touch at support@mobiscroll.com.')}`);
                        process.exit();
                    }

                    printError('npm login failed.\n\n' + err);
                    reject(err);
                });
        }).catch(err => {
            reject(err);
        });
    });
}

function testInstalledCLI(checkCmd, installCmd, helpCmd, name, type) {
    runCommand(checkCmd, true, true, true).then((data) => { // check if the specific cli is installed ex: ionic -v
        if (data) {
            // if it the specific cli is installed print the next steps section
            helperMessages.startNextSteps(name, helpCmd);
        } else {
            // if not installed ask permission to install
            inquirer.prompt({
                type: 'input',
                name: 'confirm',
                message: `It looks like the ${type + ' cli'} is not installed and it is required by this starter. Would you like us to install it for you? (Y/n)`,
                default: 'Y',
            }).then(answer => {
                if (answer.confirm.toLowerCase() == 'y') {
                    runCommand(installCmd, true, true).then(() => { // install the specific cli
                        helperMessages.startNextSteps(name, helpCmd);
                    })
                } else {
                    console.log(`The ${type + ' cli'} have to be installed in order to this starter work. You can install manually with the following command: ${chalk.cyan(installCmd)}`);
                }
            })
        }
    });
}

module.exports = {
    checkTypescriptVersion: (packageJson) => {
        var version = (packageJson.devDependencies ? packageJson.devDependencies.typescript : '') || packageJson.dependencies.typescript;

        var v = shapeVersionToArray(version);

        if (v[0] < 2 || v[0] == 2 && v[1] < 2) {
            printWarning(`Your app's TypeScript version is older then the minimum required version for Mobiscroll. (${version} < 2.2.0) Please update your project's Typescript version. (You can update the following way: $ npm install typescript@latest)`)
            return false;
        }

        if (v.length === 0) {
            printWarning(`No TypeScript version was found in the package.json. The TypeScript >= 2.2.0 is required for the @mobiscroll/angular package.`);
        }

        return true;
    },
    installMobiscrollLite: function (framework, version, callback) {
        framework = (framework.indexOf('ionic') > -1 ? 'angular' : framework);
        runCommand(`npm install @mobiscroll/${framework}-lite@${version || 'latest'} --save`, true).then(() => {
            printFeedback(`The lite version of Mobiscroll for ${framework} installed.`);
            callback();
        });
    },
    removeUnusedPackages: function (framework, packageJsonLocation, isTrial, isLite, callback, noNpm) {
        framework = (framework.indexOf('ionic') > -1 ? 'angular' : framework);

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
        runCommand('npm whoami --registry=' + mbscNpmUrl + (proxy ? ' --proxy ' + proxy : ''), false, true).then((userName) => {
            if (userName) {
                userName = userName.trim();
                console.log(`  Logged in as ${userName}`);
                return userName;
            }
            console.log(`  Logging in to the Mobiscroll NPM registry...`);
            return login(useGlobalNpmrc, proxy);
        }, (err) => {
            console.log('Login error' + err);
        }).then((userName) => {
            getApiKey(userName, proxy, framework, installHandler);

            function installHandler(data) {
                const instVersion = installVersion || data.LatestVersion;

                if (data.HasAccess === false && data.License !== '') {

                    if (data.License === 'complete') {
                        printWarning(`Looks like your maitenance agreement expired. You can check and renew your maintenance from your account at: ${chalk.gray('https://mobiscroll.com/account/licenses')}`);
                    } else {
                        printWarning(`Looks like you don't have access to ${chalk.gray('@mobiscroll/' + framework)} or your maintenance agreement is expired. Make sure to double check your license and/or renew your maintenance agreement from your account: ${chalk.gray('https://mobiscroll.com/account/licenses')}`);
                    }

                    if (data.License === 'component') {
                        printWarning(`With a Component license the CLI can't install from NPM. Go to ${chalk.gray('https://download.mobiscroll.com')}, manually download the package, copy it into your project and run the same command with the ${chalk.gray('--no-npm')} flag.`);
                        printWarning(`If you wish to use NPM installs, you can always upgrade to the Framework or Complete license.`);
                    }

                    printWarning(`In case there's any trouble, submit a support ticket from: ${chalk.gray('https://mobiscroll.com/account/supporttickets')}`);

                    inquirer.prompt({
                        type: 'input',
                        name: 'confirm',
                        message: `Would you like to install the trial version? (y/N)`,
                        default: 'N',
                    }).then(answer => {
                        if (answer.confirm.toLowerCase() == 'y') {
                            callback(data.userName, true, data);
                        } else {
                            process.exit();
                        }
                    })
                } else {
                    if (data.HasAccess) {
                        if (!data.NpmUser && !data.NpmUserNoWarn) {
                            if (data.NpmUserSet) {
                                printWarning(`You are not logged in with the NPM user that was set up for your team. Please use the credentials for the NPM user.`);
                                printWarning(`You can check out the credentials of the NPM User on your licences page at: ${chalk.gray('https://mobiscroll.com/account/licenses')}`);
                                login(useGlobalNpmrc, proxy).then((userName) => {
                                    getApiKey(userName, proxy, framework, installHandler)
                                }).catch((err) => console.log('Login error ' + err));
                                return;
                            } else {
                                printNpmWarning('team access not set up', `Looks like you don't have team NPM access configured. Please head on over to your account page to set it up: ${chalk.gray('https://mobiscroll.com/account/licenses#npm-user-setup')}\n`);
                            }
                        }
                    }
                    callback(userName, data.LatestVersion && !isTrial ? (semver.gt('3.2.4', (semver.valid(instVersion) ? instVersion : semver.coerce(instVersion)))) : true, data);
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

        switch (framework) {
            case 'ionic':
                const dependencies = packageJson && packageJson.dependencies;
                frameworkName = dependencies && dependencies['@ionic/react'] ? 'react' : dependencies['@ionic/vue'] ? 'vue' : 'angular';
                break;
            default:
                frameworkName = framework;
                break;
        }


        let isIvy = false;
        if (frameworkName === 'angular' && packageJson && packageJson.dependencies) {
            angularVersionRaw = packageJson.dependencies['@angular/core'];
            angularVersionArr = shapeVersionToArray(angularVersionRaw);
            isIvy = angularVersionArr[0] >= 13;
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

            isIvy = isIvy && semver.gte(installVersion || version, '5.23.0');

            let pkgName = package + (isIvy ? '-ivy' : '') + (isTrial ? '-trial' : ''),
                command;

            if (isYarn2) {
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

                    if (!isTokenAvailable || isNpmrcAvailable) {
                        // if no mobiscroll token is available, then get it form the .npmrc file and update/create the .yarnrc.yml with the necessary settings
                        printLog('Updating .yarnrc.yml file with npm auth token')
                        let AUTH_TOKEN = '';
                        data = data || {};
                        if (isNpmrcAvailable) {
                            const npmrcData = fs.readFileSync(npmrcPath, 'utf8').toString();
                            const tokenRow = npmrcData.match(dataRowRegex);

                            if (tokenRow.length > 1) {
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
                } catch (err) {
                    printError('Couldn\'t copy the npm auth token from the .npmrc to the .yarnrc.yml file. \n\nHere is the error message:\n\n' + err);
                }
            }

            let installCmd = usePnpm ? 'pnpm add' : useYarn ? 'yarn add' : 'npm install';
            if (isTrial) {
                command = `${installCmd} @mobiscroll/${frameworkName}@npm:@mobiscroll/${pkgName}@${installVersion || version}`; // todo test --update-checksums
            } else {
                if (isIvy) {
                    command = `${installCmd} @mobiscroll/angular@npm:@mobiscroll/${pkgName}@${installVersion || version} ${isYarn2 ? '' : ' --save'}`;
                } else {
                    command = `${installCmd} @mobiscroll/${pkgName}@${installVersion || version} ${isYarn2 ? '' : ' --save'}`;
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
                runCommand(command, true).then((out) => {
                    // let version = /@mobiscroll\/[a-z]+@([0-9a-z.-]+)/gmi.exec(out)[1]; // TODO handle when the npm install didn't return the package name and the version
                    printFeedback(`Mobiscroll for ${framework} installed.`);
                    callback(installVersion || version);
                }).catch((reason) => {
                    printError('Could not install Mobiscroll.\n\n' + reason);
                });
            }
        });
    },
    packMobiscroll: (packLocation, currDir, framework, useYarn, version, callback) => {
        process.chdir(packLocation); // change directory to node modules folder
        console.log(`${chalk.green('>')} changed current directory to ${packLocation}. \n`);

        runCommand(`${useYarn ? 'yarn pack' : 'npm pack'}`, true).then(() => { // run npm pack which will generate the mobiscroll package
            fs.readdir(packLocation, function (err, files) {
                if (err) {
                    printError('Could not access to the directory files.\n\n' + err);
                    return;
                }
                let mbscPackage = files.filter((f) => {
                    const rgx = new RegExp("mobiscroll-[a-z]+-v?" + version + "\.tgz");
                    return rgx.test(f);
                });

                if (mbscPackage.length) {
                    // set the current directory back to the default
                    process.chdir(currDir);

                    callback(mbscPackage[0]);
                }
            })
        });
    },
    importModules: (moduleLocation, moduleName, mbscFileName, isStandaloneComponent) => {
        console.log(`  Adding module loading scripts to ${chalk.grey(moduleName)}`);

        // Modify *.module.ts add necessary modules
        if (fs.existsSync(moduleLocation)) {
            try {
                let data = fs.readFileSync(moduleLocation, 'utf8').toString();

                if (data.indexOf('MbscModule.forRoot') === -1 || isStandaloneComponent) {
                    // let checkForRoute = data.indexOf('MbscModule.forRoot') === -1;

                    // Remove previous module load
                    // if (checkForRoute) {
                    const importRegex = /import \{ MbscModule(?:, mobiscroll)? \} from '[^']*';\s*/;
                    if (importRegex.test(data)) {
                        data = data.replace(importRegex, '');
                        data = data.replace(/[ \t]*MbscModule,[ \t\r]*\s?/, '');
                    }

                    // Add angular module imports which are needed for mobiscroll
                    data = importModule('MbscModule', mbscFileName, data, isStandaloneComponent);
                    // }
                    data = importModule('FormsModule', '@angular/forms', data, isStandaloneComponent);

                    // Remove previous api key if present
                    data = data.replace(/mobiscroll.apiKey = ['"][a-z0-9]{8}['"];\n\n?/, '');

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
    testInstalledCLI,
    printFeedback,
    printWarning,
    printError,
    printLog,
    checkMeteor,
    login,
    testYarn,
    appendContentToFile,
    checkAngularStandaloneComponent
};
