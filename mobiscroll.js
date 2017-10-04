#!/usr/bin/env node --harmony

const program = require('commander');
const inquirer = require('inquirer');
const fs = require('fs');
const npmLogin = require('npm-cli-login');
const utils = require('./src/utils.js');
const configIonic = require('./src/configIonic.js').configIonic;
const configAngular = require('./src/configAngular.js').configAngular;
const chalk = require('chalk');
const http = require('http');

var isNpmSource = true;
var isTrial = false;
var run = utils.run;
var printFeedback = utils.printFeedback;
var printError = utils.printError;
var printWarning = utils.printWarning;

process.env.HOME = process.env.HOME || ''; // fix npm-cli-login plugin on windows

function handleTrial() {
    isTrial = true;
}

function handleNpmInstall() {
    isNpmSource = false;
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

function config(projectType, currDir, packageJsonLocation, jsFileName, cssFileName, isNpmSource, apiKey) {
    switch (projectType) {
        case 'angular':
            configAngular(currDir, packageJsonLocation, jsFileName, cssFileName, isNpmSource, apiKey);
            break;
        case 'ionic':
            configIonic(currDir, packageJsonLocation, jsFileName, cssFileName, isNpmSource, apiKey);
            break;
    }
}

function login() {
    // input questions
    var questions = [{
            type: 'input',
            name: 'username',
            message: 'What is your Mobiscroll user name?'
        },
        {
            type: 'password',
            name: 'password',
            message: 'What is your Mobiscroll password?'
        }
    ];

    return new Promise((resolve, reject) => {
        inquirer.prompt(questions).then((answers) => {
            // Email address is not used by the Mobiscroll NPM registry
            npmLogin(answers.username, answers.password, 'any@any.com', 'https://npm.mobiscroll.com', '@mobiscroll').then(() => {
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

    if (projectType != 'ionic' && projectType != 'angular') {
        printWarning('Currently only Angular 2+ and Ionic 2+ projects are supported.\n\nPlease run ' + chalk.gray('mobiscroll --help') + ' for details!');
        return;
    }

    var cssFileName,
        jsFileName,
        // get the directory where the mobiscroll command was executed
        currDir = process.cwd(),
        packageJsonLocation = currDir + '/package.json';


    // check if package.json is in the current directory
    if (!fs.existsSync(packageJsonLocation)) {
        printWarning('There is no package.json in this directorty.\nPlease run this command in the project\'s root directory!');
        return;
    }

    printFeedback('Mobiscroll configuration started.');

    if (isNpmSource) {
        printFeedback('Checking logged in status...')
        // check if the user is already logged in
        run('npm whoami --registry=https://npm.mobiscroll.com', false, true).then((userName) => {
            if (userName) {
                userName = userName.trim();
                console.log(`  Logged in as ${userName}`);
                return userName;
            }
            console.log(`  Logging in to the Mobiscroll NPM registry...`);
            return login();
        }).then((userName) => {
            // if returns an api key it is a trial user
            getApiKey(userName, function (data) {
                var useTrial = !data.HasLicense || isTrial;

                jsFileName = `@mobiscroll/angular${useTrial ? '-trial' : ''}`;
                cssFileName = `../node_modules/@mobiscroll/angular${useTrial ? '-trial' : ''}/dist/css/mobiscroll.min.css`;

                // Install mobiscroll npm package
                utils.installMobiscroll('angular', userName, useTrial, function () {
                    config(projectType, currDir, packageJsonLocation, jsFileName, cssFileName, isNpmSource, (useTrial ? data.TrialCode : ''));
                });
            });
        });
    } else {
        // if --no-npm option is set
        var files,
            jsFileLocation = currDir + '/src/lib/mobiscroll/js',
            cssFileLocation = currDir + '/src/lib/mobiscroll/css';

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
    }
}

function handleLogin() {
    login();
}

function handleLogout() {
    run('npm whoami --registry=https://npm.mobiscroll.com', false, true).then((userName) => {
        if (userName) {
            run('npm logout --registry=https://npm.mobiscroll.com --scope=@mobiscroll').then(() => {
                printFeedback('Successful logout!\n');
            });
        } else {
            printFeedback('You are not logged in to the Mobiscroll npm registry!\n');
        }
    });
}

// options
program
    .version('0.2.0')
    .usage('[commands] [options]')
    .option('-t, --trial', 'The project will be tuned up with trial configuration.', handleTrial)
    .option('-n, --no-npm', 'Mobiscroll resources won\'t be installed from npm. In this case the Mobiscroll resources must be copied manually to the src/lib folder.', handleNpmInstall);

// commands

// start command

// program
//     .command('start [type]')
//     .description('Starts a new project with mobiscroll configurated in it.')
//     .action(handleStart);

// config command
program
    .command('config [type]')
    .description('Configures your current project with the Mobiscroll resources and dependecies. Installs Mobiscroll resources from npm and includes the necessary dependencies. (Currently it only supports Angular 2+ and Ionic 2+ projects.)')
    .action(handleConfig);

program
    .command('login')
    .description('Logs you in to the Mobiscroll npm registry.')
    .action(handleLogin);

program
    .command('logout')
    .description('Logs you out from the Mobiscroll npm registry.')
    .action(handleLogout);

program.parse(process.argv);

// print help if no commands or options was passed
if (!program.args.length) {
    program.help();
}