#!/usr/bin/env node

const program = require('commander');
const inquirer = require('inquirer');
const fs = require('fs');
const npmLogin = require('./src/npm-login/');
const utils = require('./src/utils.js');
const configIonic = require('./src/configIonic.js').configIonic;
const configAngular = require('./src/configAngular.js').configAngular;
const chalk = require('chalk');
const http = require('http');
const path = require('path');
const helperMessages = require('./src/helperMessages.js');

var isNpmSource = true;
var isTrial = false;
var isLite = false;
var isLazy = false;
var run = utils.run;
var printFeedback = utils.printFeedback;
var printError = utils.printError;
var printWarning = utils.printWarning;
var localCliVersion = require('./package.json').version;

process.env.HOME = process.env.HOME || ''; // fix npm-cli-login plugin on windows


function checkUpdate() {
    return new Promise((resolve) => {
        run('npm show @mobiscroll/cli version', false, false, true).then((npmCliVersion) => { // get the mobiscroll cli version from npm
            npmCliVersion = npmCliVersion.trim();

            if (localCliVersion != npmCliVersion) {
                // if the two versions are not equal ask for update
                inquirer.prompt({
                    type: 'input',
                    name: 'update',
                    message: `The Mobiscroll CLI has an update available (${localCliVersion} => ${npmCliVersion})! Would you like to install it? (Y/n)`
                }).then(answer => {
                    if (answer.update.toLowerCase() == 'y') {
                        run('npm install -g @mobiscroll/cli@latest').then(() => {
                            printFeedback(`Updated Mobscirll CLI to ${npmCliVersion}! \n\nPlease re-run your command!\n`);
                            process.exit();
                        });
                    } else {
                        console.log(`Skipping the installation of the latest Mobiscroll CLI version.`);
                        resolve();
                    }
                })
            } else {
                // No CLI update found continuing the installation...
                resolve();
            }
        })
    });
}


function handleTrial() {
    isTrial = true;
}

function handleLite() {
    isLite = true;
}

function handleNpmInstall() {
    isNpmSource = false;
}

function handleLazy() {
    isLazy = true;
}

function getApiKey(userName, callback) {
    http.get('http://api.mobiscroll.com/api/userdata/' + userName, function (res) {
        var data = '';
        res.on('data', function (chunk) {
            data += chunk;
        });

        res.on('end', function () {
            callback(data ? JSON.parse(data) : {});
        });
    }).on('error', function (err) {
        printError('There was an error during getting the user\'s trial code. Please see the error message for more information: ' + err);
    });
}

// function detectProjectFramework(packageJson, apiKey, isLite, projectType) {
//     if (packageJson.dependencies.vue) {
//         helperMessages.vueHelp(projectType, apiKey, isLite);
//         return 'vue';
//     }

//     if (packageJson.dependencies.react) {
//         helperMessages.reactHelp(apiKey, isLite);
//         return "react";
//     }

//     return;
// }

function config(projectType, currDir, packageJsonLocation, jsFileName, cssFileName, isNpmSource, apiKey, isLite) {
    var packageJson = require(packageJsonLocation);

    switch (projectType) {
        case 'angular':
            configAngular(currDir, packageJson, jsFileName, cssFileName, isNpmSource, apiKey, isLite);
            break;
            // case 'angularjs':
            //     break;
        case 'ionic':
        case 'ionic-pro':
            configIonic(currDir, packageJsonLocation, jsFileName, cssFileName, isNpmSource, apiKey, isLazy, projectType == 'ionic-pro', isLite);
            break;
            // case 'react':
            //     helperMessages.reactHelp(apiKey, isLite);
            //     break;
            // case 'jquery':
            // case 'javascript':
            //     detectProjectFramework(packageJson, apiKey, isLite, projectType);
            //     break;
    }

}

function login() {
    // input questions
    var questions = [{
        type: 'input',
        name: 'username',
        message: 'Mobiscroll email or user name:'
    }, {
        type: 'password',
        name: 'password',
        message: 'Mobiscroll password:'
    }];

    return new Promise((resolve, reject) => {
        inquirer.prompt(questions).then((answers) => {
            // Email address is not used by the Mobiscroll NPM registry
            npmLogin(answers.username, answers.password, 'any@any.com', utils.npmUrl, '@mobiscroll').then(() => {
                console.log(`  Logged in as ${answers.username}`);
                printFeedback('Successful login!\n');
                resolve(answers.username);
            }).catch(err => {
                printError('npm login failed.\n\n' + err);
                reject(err);
            });
        }).catch(err => {
            reject(err);
        });
    });
}

function handleConfig(projectType) {
    if (!projectType) {
        printWarning('No project type specified. Please specify the project type. [ionic, angular] \n\nPlease run ' + chalk.gray('mobiscroll --help') + ' to see which projects are supported.');
        return;
    }

    checkUpdate().then(() => {
        var cssFileName,
            jsFileName,
            currDir = process.cwd(), // get the directory where the mobiscroll command was executed
            packageJsonLocation = path.resolve(process.cwd(), 'package.json');
        //packageJson = require(packageJsonLocation);

        // check if package.json is in the current directory
        // if (!fs.existsSync(packageJsonLocation)) {
        //     printWarning('There is no package.json in this directorty.\nPlease run this command in the project\'s root directory!');
        //     return;
        // }

        printFeedback('Mobiscroll configuration started.');

        if (isLite) {
            utils.installMobiscrollLite(projectType, function () {
                jsFileName = 'mobiscroll-angular';
                cssFileName = `../node_modules/mobiscroll-angular/dist/css/mobiscroll.min.css`;

                config(projectType, currDir, packageJsonLocation, jsFileName, cssFileName, false, false, true);
            })
        } else if (isNpmSource) {
            printFeedback('Checking logged in status...');
            // check if the user is already logged in
            run('npm whoami --registry=' + utils.npmUrl, false, true).then((userName) => {
                if (userName) {
                    userName = userName.trim();
                    console.log(`  Logged in as ${userName}`);
                    return userName;
                }
                console.log(`  Logging in to the Mobiscroll NPM registry...`);
                return login();
            }).then((userName) => {
                // if returns an api key it is a trial user
                getApiKey(userName, (data) => {
                    var useTrial = !data.HasLicense || isTrial;

                    jsFileName = `@mobiscroll/angular${useTrial ? '-trial' : ''}`;
                    cssFileName = `../node_modules/@mobiscroll/angular${useTrial ? '-trial' : ''}/dist/css/mobiscroll.min.css`;

                    utils.removeUnusedaPackages(projectType, packageJsonLocation, useTrial, false, () => {
                        // Install mobiscroll npm package
                        utils.installMobiscroll(projectType, userName, useTrial, () => {
                            //     setTimeout(() => {
                            config(projectType, currDir, packageJsonLocation, jsFileName, cssFileName, isNpmSource, (useTrial ? data.TrialCode : ''));
                            //     }, 2000)
                        });
                    });
                });
            });
        } else {
            // if no-npm flag is set
            var files,
                jsFileLocation = currDir + '/src/lib/mobiscroll/js',
                cssFileLocation = currDir + '/src/lib/mobiscroll/css';

            utils.removeUnusedaPackages(projectType, packageJsonLocation, false, false, () => {

                // check if moibscroll js files are copied to the specific location and get the js file name
                if (fs.existsSync(jsFileLocation)) {
                    files = fs.readdirSync(currDir + '/src/lib/mobiscroll/js');
                    jsFileName = files.filter(function (item) {
                        return item.match(/^mobiscroll\..*\.js$/);
                    });
                }

                // check if css files are copied to the specific location and get the css file name
                if (fs.existsSync(cssFileLocation)) {
                    files = fs.readdirSync(currDir + '/src/lib/mobiscroll/css');
                    cssFileName = files.filter(function (item) {
                        return item.match(/^mobiscroll\..*\.css$/);
                    });
                }

                if (!jsFileName || !cssFileName) {
                    printWarning('No mobiscroll js/css files were found in your current project. \n\nPlease make sure to unpack the downloaded mobiscroll package and copy the lib folder to the src folder of your app!');
                    return;
                }

                jsFileName = '../lib/mobiscroll/js/' + jsFileName[0];
                cssFileName = 'lib/mobiscroll/css/' + cssFileName[0];

                config(projectType, currDir, packageJsonLocation, jsFileName, cssFileName, isNpmSource);
            }, true);
        }
    })
}

function handleLogin() {
    login();
}

function handleLogout() {
    run('npm whoami --registry=' + utils.npmUrl, false, true).then((userName) => {
        if (userName) {
            run(`npm logout --registry=${utils.npmUrl} --scope=@mobiscroll`).then(() => {
                printFeedback('Successful logout!\n');
            });
        } else {
            printFeedback('You are not logged in to the Mobiscroll npm registry!\n');
        }
    });
}

// options
program
    .version(localCliVersion)
    .usage('[commands] [options]');

// commands

// config command
program
    .command('config [types]')
    .description('Configures your current project with the Mobiscroll resources and dependecies. Installs Mobiscroll resources from npm and includes the necessary dependencies. (types: angular, angularjs, ionic, ionic-pro, javascript, jquery)\n')
    .action(handleConfig)
    .on('--help', helperMessages.configHelp)
    .option('-l, --lazy', 'Skipping MbscModule injection from app.module.ts in case of Ionic lazy loading project.\n', handleLazy)
    .option('-t, --trial', 'The project will be tuned up with trial configuration.\n', handleTrial)
    .option('-i, --lite', 'The project will be tuned up with lite configuration.\n', handleLite)
    .option('-n, --no-npm', 'Mobiscroll resources won\'t be installed from npm. In this case the Mobiscroll resources must be copied manually to the src/lib folder.\n', handleNpmInstall);

program
    .command('login')
    .description('Logs you in to the Mobiscroll npm registry.\n')
    .action(handleLogin);

program
    .command('logout')
    .description('Logs you out from the Mobiscroll npm registry.\n')
    .action(handleLogout);

program.parse(process.argv);

// print help if no commands or options was passed
if (!program.args.length) {
    program.help();
}