#!/usr/bin/env node --harmony

const program = require('commander');
const inquirer = require('inquirer');
const fs = require('fs');
const npmLogin = require('npm-cli-login');
const utils = require('./src/utils.js');
const configIonic = require('./src/configIonic.js').configIonic;
//const configAngular = require('./src/configAngular.js').configAngular;
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

function config(userName, packageJsonLocation, currDir, jsFileName, cssFileName) {
    // if returns an api key it is a trial user
    getApiKey(userName, function (data) {
        var useTrial = !data.HasLicense || isTrial;
        if (useTrial) {
            jsFileName += '-trial';
        }
        // Install mobiscroll npm package
        utils.installMobiscroll('angular', packageJsonLocation, useTrial, function () {
            configIonic(currDir, packageJsonLocation, jsFileName, cssFileName, isNpmSource, (useTrial ? data.TrialCode : ''));
        });
    });
}

function handleConfig(projectType) {
    if (!projectType) {
        printWarning('No project type specified. Please specify the project type. [ionic] \n\nPlease run ' + chalk.gray('mobiscroll --help') + ' to see which projects are supported.');
        return;
    }

    if (projectType != 'ionic') {
        printWarning('Currently only Ionic 2/3 projects are supported.\n\nPlease run ' + chalk.gray('mobiscroll --help') + ' for details!');
        return;
    }

    var cssFileName,
        jsFileName,
        // get the directory where the mobiscroll command was executed
        currDir = process.cwd(),
        packageJsonLocation = currDir + '/package.json';


    // check if package.json is in the current directory
    if (!fs.existsSync(packageJsonLocation)) {
        printWarning('There is no ' + projectType + ' package.json in this directorty.\nPlease run this command in the project\'s root directory!');
        return;
    }

    if (isNpmSource) {
        printFeedback('Mobiscroll config started.');
        // check if the user is already logged in
        run('npm whoami --registry=https://npm.mobiscroll.com', false, true).then((userName) => {
            jsFileName = '@mobiscroll/angular';
            cssFileName = 'lib/mobiscroll/css/mobiscroll.min.css';

            if (!userName) {
                login.then((userName) => {
                    config(userName, packageJsonLocation, currDir, jsFileName, cssFileName);
                });
            } else {
                // if the user is logged in install mobiscroll form npm and run ionc config
                config(userName, packageJsonLocation, currDir, jsFileName, cssFileName)
            }
        });
    } else {
        // if --no-npm option is set
        printFeedback('Config without npm install started.');

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

        configIonic(currDir, packageJsonLocation, jsFileName, cssFileName, isNpmSource);
    }
}

function handleLogin() {
    login();
}

function handleLogout() {
    run('npm whoami --registry=https://npm.mobiscroll.com', false, true).then((userName) => {
        if (userName) {
            run('npm logout --registry=https://npm.mobiscroll.com').then(() => {
                printFeedback('Successful logout!\n');
            });
        } else {
            printFeedback('You are not logged in to the Mobiscroll npm registry!\n');
        }
    });
}

// options
program
    .version('0.1.2')
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
    .description('Configures your current project with the Mobiscroll resources and dependecies. Installs Mobiscroll resources from npm and includes the necessary dependencies. (Currently it only supports Ionic 2/3 projects.)')
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