const fs = require('fs');
const chalk = require('chalk');
const exec = require('child_process').exec;
const execSync = require('child_process').execSync;
const request = require('request');
const mbscNpmUrl = 'https://npm.mobiscroll.com';
const terminalLink = require('terminal-link');
const inquirer = require('inquirer');
const path = require('path');
const npmLogin = require('./npm-login/');
const helperMessages = require('./helperMessages.js');
const ncp = require('ncp').ncp;
var semver = require('semver');

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

function testYarn(currDir) {
    // check if a yarn.lock exists
    return fs.existsSync(path.resolve(currDir, 'yarn.lock'))
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

function runCommandSync(cmd) {
    try {
        return (execSync(cmd)).toString('utf8');
    } catch (error) {
        console.log('Could not run command ' + chalk.gray(cmd) + '. \n\n' + error);
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

function appendContentToFile(location, newData, replaceRegex, prepend, callback) {
    try {
        let fileData = fs.readFileSync(location).toString();

        if (replaceRegex) {
            fileData = fileData.replace(replaceRegex, '');
        }

        if (fileData && fileData.indexOf(newData) == -1) {
            writeToFile(location, prepend ? newData + '\r\n' + fileData : fileData + '\r\n' + newData, callback);
        } else if (callback) {
            callback(null);
        }
    } catch (err) {
        printError('Could append to file ' + chalk.gray(location) + '. \n\n' + err);
    }
}

function importModule(moduleName, location, data) {
    if (data.indexOf(moduleName) == -1) { // check if module is not loaded
        data = "import { " + moduleName + " } from '" + location + "';\n" + data;
        data = data.replace('imports: [', 'imports: [ \n' + '    ' + moduleName + ', ');
    }
    return data;
}

function getMobiscrollVersion(proxy, callback) {
    var requestOptions = {
        url: 'https://api.mobiscroll.com/api/getmobiscrollversion'
    }

    if (proxy) {
        requestOptions.proxy = proxy;
    }

    request(requestOptions, function (error, response, body) {
        if (error) {
            printError('Could not get mobiscroll version.' + error);
        }

        if (!error && response.statusCode === 200) {
            body = JSON.parse(body);
            callback(body.Version);
        }
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
        url: 'https://api.mobiscroll.com/api/access/' + userName + '/' + framework,
        json: true,
        headers: {
            'User-Agent': 'request'
        }
    }

    if (proxy) {
        requestOptions.proxy = proxy;
    }

    request(requestOptions, (err, res, data) => {
        if (err) {
            printError('There was an error during getting the user\'s trial code. Please see the error message for more information: ' + err);
        } else if (res.statusCode !== 200) {
            printError('There was a problem during getting the user\'s trial code. Status: ' + res.statusCode + ' , User: ' + userName);
        } else {
            callback(data);
        }
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

function login(useGlobalNpmrc) {
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
        message: 'Mobiscroll password:',
        validate: function validatePassword(passw) {
            return passw !== '';
        }
    }];

    return new Promise((resolve, reject) => {
        inquirer.prompt(questions).then((answers) => {
            // Email address is not used by the Mobiscroll NPM registry
            npmLogin(answers.username, answers.password, 'any@any.com', mbscNpmUrl, '@mobiscroll', null, (useGlobalNpmrc ? undefined : path.resolve(process.cwd(), '.npmrc'))).then(() => {
                console.log(`  Logged in as ${answers.username}`);
                printFeedback('Successful login!\n');
                resolve(answers.username);
            }).catch(err => {
                err = err.toString();
                if (err.indexOf("Could not find user with the specified username or password") !== -1 || err.indexOf("Incorrect username or password") !== -1) {
                    printWarning(`We couldn’t log you in. This might be  either because your account does not exist or you mistyped your login information. You can update your credentials ` + terminalLink('from your account', 'https://mobiscroll.com/account') + '.');
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
        runCommand(`npm install @mobiscroll/${framework}-lite@${ version || 'latest' } --save`, true).then(() => {
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
        runCommand('npm whoami --registry=' + mbscNpmUrl, false, true).then((userName) => {
            if (userName) {
                userName = userName.trim();
                console.log(`  Logged in as ${userName}`);
                return userName;
            }
            console.log(`  Logging in to the Mobiscroll NPM registry...`);
            return login(useGlobalNpmrc);
        }, (err) => {
            console.log('Login error' + err);
        }).then((userName) => {
            // if returns an api key it is a trial user
            getApiKey(userName, proxy, framework, (data) => {
                if (!installVersion) {
                    installVersion = data.LatestVersion;
                }

                callback(userName, data.LatestVersion && !isTrial ? semver.gt('3.2.4', installVersion) : true, data);
            });
        });
    },

    installMobiscroll: (config, callback) => {
        var framework = config.projectType,
            currDir = config.currDir,
            isTrial = config.useTrial,
            installVersion = config.mobiscrollVersion,
            proxy = config.proxyUrl,
            packageJson = config.packageJson,
            frameworkName = '';

        switch (framework) {
            case 'ionic':
            case 'ionic-pro':
                frameworkName = packageJson && packageJson.dependencies && packageJson.dependencies['@ionic/react'] ? 'react' : 'angular';
                break;
            case 'vue':
                frameworkName = 'javascript';
                break;
            default:
                frameworkName = framework;
                break;
        }

        var pkgName = frameworkName + (isTrial ? '-trial' : ''),
            command;

        getMobiscrollVersion(proxy, (version) => {
            let useYarn = testYarn(currDir);
            let installCmd = useYarn ? 'yarn add' : 'npm install';
            if (isTrial) {
                command = `${installCmd} ${mbscNpmUrl}/@mobiscroll/${pkgName}/-/${pkgName}-${version}.tgz --save --registry=${mbscNpmUrl}`;
            } else {
                command = `${installCmd} @mobiscroll/${pkgName}@${ installVersion || 'latest' } --save`;
            }

            // Skip node warnings
            printFeedback(`Installing packages via ${useYarn ? 'yarn' : 'npm'}...`);
            runCommand(command, true).then((out) => {
                let version = out.match(/@([0-9.-]+)/gmi)[0];

                printFeedback(`Mobiscroll for ${framework} installed.`);
                callback(installVersion || version.replace('@', ''));
            }).catch((reason) => {
                if (/403 Forbidden/.test(reason)) {
                    printWarning(`Looks like you have a Component license. That means NPM install is not supported. You can go https://download.mobiscroll.com, manually download the package, copy it into your project and run the same command with the ${chalk.gray('--no-npm')} flag.`);
                    printWarning(`If you wish to use NPM installs, you can always upgrade to the Framework or Complete license.`);
                    printWarning(`Feel free to get in touch or let us know if there is any trouble at support@mobiscroll.com`);
                    process.exit();
                } else {
                    printError('Could not install Mobiscroll.\n\n' + reason);
                }
            });
        })
    },
    packMobiscroll: (packLocation, currDir, framework, useYarn, callback) => {
        process.chdir(packLocation); // change directory to node modules folder
        console.log(`${chalk.green('>')} changed current directory to ${packLocation}. \n`);

        runCommand(`${ useYarn ? 'yarn pack' : 'npm pack'}`, true).then(() => { // run npm pack which will generate the mobiscroll package
            fs.readdir(packLocation, function (err, files) {
                if (err) {
                    printError('Could not access to the directory files.\n\n' + err);
                    return;
                }

                let mbscPackage = files.filter((f) => {
                    // return the full name of the generated package
                    return f.includes(`mobiscroll-${framework}`);
                });

                if (mbscPackage.length) {
                    // set the current directory back to the default
                    process.chdir(currDir);
                    //console.log(`\n${chalk.green('>')} Changed back current directory to the default one. \n`);

                    callback(mbscPackage[0]);
                }
            })
        });
    },
    importModules: function (moduleLocation, moduleName, mbscFileName) {
        console.log(`  Adding module loading scripts to ${chalk.grey(moduleName)}`);

        // Modify *.module.ts add necessary modules
        if (fs.existsSync(moduleLocation)) {
            try {
                let data = fs.readFileSync(moduleLocation, 'utf8').toString();

                let checkForRoute = data.indexOf('MbscModule.forRoot') == -1;

                // Remove previous module load
                if (checkForRoute) {
                    data = data.replace(/import \{ MbscModule(?:, mobiscroll)? \} from '[^']*';\s*/, '');
                    data = data.replace(/[ \t]*MbscModule,[ \t\r]*\s?/, '');

                    // Add angular module imports which are needed for mobiscroll
                    data = importModule('MbscModule', mbscFileName, data);
                }
                data = importModule('FormsModule', '@angular/forms', data);

                // Remove previous api key if present
                data = data.replace(/mobiscroll.apiKey = ['"][a-z0-9]{8}['"];\n\n?/, '');

                writeToFile(moduleLocation, data);
            } catch (err) {
                printError('There was an error during reading app.module.ts. \n\nHere is the error message:\n\n' + err);
                return;
            }
        } else if (moduleName == 'app.module.ts') {
            printWarning(`No app.module.ts file found. You are probably running this command in a non Angular-cli based application. Please visit the following page for further instructions:`);
            console.log(terminalLink('Mobiscroll Angular Docs - Quick install', 'https://docs.mobiscroll.com/angular/quick-install'))
            return false;
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
    appendContentToFile
};