#!/usr/bin/env node

const program = require('commander');
const inquirer = require('inquirer');
const fs = require('fs');
const npmLogin = require('./src/npm-login/');
const utils = require('./src/utils.js');
const configIonic = require('./src/configIonic.js').configIonic;
const configAngular = require('./src/configAngular.js').configAngular;
const chalk = require('chalk');
const request = require('request');
const path = require('path');
const helperMessages = require('./src/helperMessages.js');
const ncp = require('ncp').ncp;
const figlet = require('figlet');
const os = require('os');

var isNpmSource = true;
var isTrial = false;
var isLite = false;
var isLazy = false;
var run = utils.run;
var printFeedback = utils.printFeedback;
var printError = utils.printError;
var printWarning = utils.printWarning;
var localCliVersion = require('./package.json').version;
var mobiscrollVersion = null;
var useGlobalNpmrc = false;

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
                    message: `The Mobiscroll CLI has an update available (${localCliVersion} => ${npmCliVersion})! Would you like to install it? (Y/n)`,
                    default: 'y'
                }).then(answer => {
                    if (answer.update.toLowerCase() == 'y') {
                        run('npm install -g @mobiscroll/cli@latest').then(() => {
                            printFeedback(`Updated Mobiscroll CLI to ${npmCliVersion}! \n\nPlease re-run your command!\n`);
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

function removeTokenFromNpmrc(path) {
    if (fs.existsSync(path)) {
        let content = (fs.readFileSync(path)).toString();
        if (content.length > 5) {
            content = content.replace(/@mobiscroll:registry=https:\/\/npm\.mobiscroll\.com\s+(\S+)$/gmi, '');
            utils.writeToFile(path, content, () => {
                printFeedback('Successful logout!\n');
            });
        } else {
            printFeedback('You are not logged in to the Mobiscroll npm registry!\n');
            if (!useGlobalNpmrc) {
                console.log(`${chalk.yellow('Please Note:')} If you are logged in globally you will have to use the -g/--global flag with this command.\n\nUsage: ${chalk.gray('mobiscroll logout -g')}`);
            }
        }
    }
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

function handleMobiscrollVersion(vers) {
    mobiscrollVersion = vers;
}

function handleGlobalInstall() {
    useGlobalNpmrc = true;
}

function getApiKey(userName, callback) {
    request.get({
        url: 'https://api.mobiscroll.com/api/userdata/' + userName,
        json: true,
        headers: {
            'User-Agent': 'request'
        }
    }, (err, res, data) => {
        if (err) {
            printError('There was an error during getting the user\'s trial code. Please see the error message for more information: ' + err);
        } else if (res.statusCode !== 200) {
            printError('There was a problem during getting the user\'s trial code. Status: ' + res.statusCode + ' , User: ' + userName);
        } else {
            callback(data);
        }
    });
}

function detectProjectFramework(packageJson, apiKey, isLite, projectType) {
    if (packageJson.dependencies.vue) {
        helperMessages.vueHelp(projectType, apiKey, isLite);
        return 'vue';
    }

    if (packageJson.dependencies.react) {
        helperMessages.reactHelp(apiKey, isLite);
        return "react";
    }

    return;
}

function config(projectType, currDir, packageJsonLocation, jsFileName, cssFileName, isNpmSource, apiKey, isLite) {
    var packageJson = require(packageJsonLocation);

    switch (projectType) {
        case 'angular':
            configAngular(currDir, packageJson, jsFileName, cssFileName, isNpmSource, apiKey, isLite);
            break;
        case 'angularjs':
            break;
        case 'ionic':
        case 'ionic-pro':
            configIonic(currDir, packageJsonLocation, jsFileName, cssFileName, isNpmSource, apiKey, isLazy, projectType == 'ionic-pro', isLite);
            break;
        case 'react':
            helperMessages.reactHelp(apiKey, isLite);
            break;
        case 'jquery':
        case 'javascript':
            detectProjectFramework(packageJson, apiKey, isLite, projectType);
            break;
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
            npmLogin(answers.username, answers.password, 'any@any.com', utils.npmUrl, '@mobiscroll', null, (useGlobalNpmrc ? undefined : path.resolve(process.cwd(), '.npmrc'))).then(() => {
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
        printWarning('Please specify the project type. [ionic, angular, angularjs, react, javascript, jquery] \n\nFor more information please run the ' + chalk.gray('mobiscroll config --help') + ' command.');
        return;
    }

    checkUpdate().then(() => {
        var jsFileName = `@mobiscroll/angular${ isLite ? '-lite' : '' }`,
            cssFileName = `../node_modules/@mobiscroll/angular${ isLite ? '-lite' : '' }/dist/css/mobiscroll.min.css`,
            currDir = process.cwd(), // get the directory where the mobiscroll command was executed
            packageJsonLocation = path.resolve(currDir, 'package.json');

        // check if package.json is in the current directory
        if (!fs.existsSync(packageJsonLocation)) {
            printWarning('There is no package.json in this directory.\nPlease run this command in the project\'s root directory!');
        }

        printFeedback('Mobiscroll configuration started.');

        if (isLite) {
            utils.installMobiscrollLite(projectType, mobiscrollVersion, function () {
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

                    utils.removeUnusedPackages(projectType, packageJsonLocation, useTrial, false, () => {
                        // Install mobiscroll npm package
                        utils.installMobiscroll(projectType, currDir, userName, useTrial, mobiscrollVersion, () => {
                            config(projectType, currDir, packageJsonLocation, jsFileName, cssFileName, isNpmSource, (useTrial ? data.TrialCode : ''));
                        });
                    });
                });
            });
        } else {
            // if no-npm flag is set
            var files,
                localCssFileName,
                localJsFileName,
                mbscFolderLocation = path.resolve(currDir, 'src', 'lib', 'mobiscroll'),
                jsFileLocation = path.resolve(mbscFolderLocation, 'js'),
                cssFileLocation = path.resolve(mbscFolderLocation, 'css'),
                framework = projectType == 'ionic' ? 'angular' : projectType;

            utils.removeUnusedPackages(projectType, packageJsonLocation, false, false, () => {

                // check if mobiscroll js files are copied to the specific location and get the js file name
                if (fs.existsSync(jsFileLocation)) {
                    files = fs.readdirSync(jsFileLocation);
                    localJsFileName = files.filter(function (item) {
                        return item.match(/^mobiscroll\..*\.js$/);
                    });
                }

                // check if css files are copied to the specific location and get the css file name
                if (fs.existsSync(cssFileLocation)) {
                    files = fs.readdirSync(cssFileLocation);
                    localCssFileName = files.filter(function (item) {
                        return item.match(/^mobiscroll\..*\.css$/);
                    });
                }

                if (!localJsFileName || !localCssFileName) {
                    printWarning('No mobiscroll js/css files were found in your current project. \n\nPlease make sure to unpack the downloaded mobiscroll package and copy the lib folder to the src folder of your app!');
                    return;
                }

                utils.getMobiscrollVersion((version) => {
                    let packageFolder = path.resolve(currDir, 'src', 'lib', 'mobiscroll-package');
                    let distFolder = path.resolve(packageFolder, 'dist');

                    // create new folders
                    if (!fs.existsSync(packageFolder)) {
                        fs.mkdirSync(packageFolder, 0o777);
                        fs.mkdirSync(distFolder, 0o777);
                    }

                    // copy the mobiscroll resources to another folder for packing
                    ncp(mbscFolderLocation, path.resolve(distFolder), (err) => {
                        if (err) {
                            utils.printError('Could not copy Mobiscroll resources.\n\n' + err);
                            return;
                        }

                        let noNpmPackageJson = require(path.resolve(__dirname, 'resources', framework, 'pckg.json'));

                        console.log(`\n${chalk.green('>')} Mobiscroll resources was copied successfully.`);

                        // create the package.json file for the
                        noNpmPackageJson.version = version;
                        if (noNpmPackageJson.main) {
                            noNpmPackageJson.main = noNpmPackageJson.main + localJsFileName[0];
                        }
                        if (noNpmPackageJson.module) {
                            noNpmPackageJson.module = noNpmPackageJson.module + localJsFileName[0];
                        }
                        if (noNpmPackageJson.types) {
                            noNpmPackageJson.types = noNpmPackageJson.types + localJsFileName[0].replace('js', 'd.ts');
                        }
                        if (noNpmPackageJson.style) {
                            noNpmPackageJson.style = noNpmPackageJson.style + localCssFileName[0];
                        }

                        // remove previously installed mobiscroll package (fix npm caching the local package)
                        utils.run(`npm uninstall @mobiscroll/${framework} --save`, true).then(() => {

                            // write the new package.json
                            utils.writeToFile(path.resolve(packageFolder, 'package.json'), JSON.stringify(noNpmPackageJson, null, 2), () => {
                                // pack with npm pack
                                utils.packMobiscroll(packageFolder, currDir, framework, (packageName) => {
                                    let packageJson = require(packageJsonLocation);

                                    packageJson.dependencies[`@mobiscroll/${framework}`] = 'file:./src/lib/mobiscroll-package/' + packageName;

                                    utils.writeToFile(packageJsonLocation, JSON.stringify(packageJson, null, 4), () => {
                                        console.log(`${chalk.green('>')  + chalk.grey(' package.json')} modified to load mobiscroll form the generated tzg file. \n`);

                                        // run npm install
                                        utils.run('npm install', true).then(() => {
                                            cssFileName = (projectType == 'ionic' ? 'lib/mobiscroll/css/' : `../node_modules/@mobiscroll/${framework}/dist/css/`) + localCssFileName;
                                            config(projectType, currDir, packageJsonLocation, jsFileName, cssFileName, isNpmSource);
                                        });

                                        console.log(`\n${chalk.green('>')} Removing unused mobiscroll files.`);
                                        fs.unlinkSync(path.resolve(packageFolder, 'package.json')); // delete the package.json in dist
                                        utils.deleteFolder(mbscFolderLocation); // delete source folder
                                        utils.deleteFolder(distFolder); // delete created
                                    });
                                });
                            });
                        });
                    });

                });
            }, true);
        }
    })
}

function handleLogin() {
    login();
}

function handleLogout() {
    removeTokenFromNpmrc(path.resolve((useGlobalNpmrc ? os.homedir() : process.cwd()), '.npmrc'));
}

// options
program
    .version(localCliVersion, '-v')
    .option('-g, --global', 'Modify the Mobiscroll npm login credentials save/use location to the global .npmrc file. Starting from cli v0.6.0 by default it is saved in the application\'s directory.', handleGlobalInstall)
    .usage('[commands] [options]');

// commands

// config command
program
    .command('config [types]')
    .description(`Configures your current project with the Mobiscroll resources and dependencies. For more information run the ${chalk.gray('mobiscroll config --help')} command.\n`)
    .action(handleConfig)
    .on('--help', helperMessages.configHelp)
    .option('-l, --lazy', 'Skipping MbscModule injection from app.module.ts in case of Ionic lazy loading project.\n', handleLazy)
    .option('-t, --trial', 'The project will be tuned up with trial configuration.\n', handleTrial)
    .option('-i, --lite', 'The project will be tuned up with lite configuration.\n', handleLite)
    .option('-n, --no-npm', 'Mobiscroll resources won\'t be installed from npm. In this case the Mobiscroll resources must be copied manually to the src/lib folder.\n', handleNpmInstall)
    .option('--version [version]', 'Pass the Mobiscroll version which you want to install.\n', handleMobiscrollVersion);

program
    .command('login')
    .description('Logs you in to the Mobiscroll npm registry. (Use the --global flag if you want to login globally). \n')
    .action(handleLogin);

program
    .command('logout')
    .description('Logs you out from the Mobiscroll npm registry. (Use the --global flag if you want to log out globally).\n')
    .action(handleLogout);

program.parse(process.argv);

// print help if no commands or options was passed
if (!program.args.length) {
    console.log(figlet.textSync('Mobiscroll CLI'));
    console.log('  Version: ' + localCliVersion);
    program.help();
}