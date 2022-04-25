#!/usr/bin/env node

const program = require('commander');
const inquirer = require('inquirer');
const fs = require('fs');
const utils = require('./src/utils.js');
const configIonic = require('./src/configIonic.js').configIonic;
const configAngular = require('./src/configAngular.js').configAngular;
const chalk = require('chalk');
const path = require('path');
const helperMessages = require('./src/helperMessages.js');
const ncp = require('ncp').ncp;
const figlet = require('figlet');
const os = require('os');
const clone = require('git-clone');
const semver = require('semver');

var isNpmSource = true;
var isTrial = false;
var isLite = false;
var isLazy = false;
var run = utils.run;
var printFeedback = utils.printFeedback;
//var printError = utils.printError;
var printWarning = utils.printWarning;
var localCliVersion = require('./package.json').version;
var mobiscrollVersion = null;
var useGlobalNpmrc = false;
var proxyUrl = '';
var useScss = undefined;
var startIoncVesrion = '';

process.env.HOME = process.env.HOME || ''; // fix npm-cli-login plugin on windows

function checkUpdate() {
    return new Promise((resolve) => {
        run('npm show @mobiscroll/cli version', true, true, true).then((npmCliVersion) => { // get the mobiscroll cli version from npm

            if (npmCliVersion) {
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
            } else {
                utils.printWarning(`It looks like the CLI couldn't determine the installed cli version. This problem might indicate npm problems on your system. You can update it manually by running the ${chalk.gray('npm install npm@latest -g')} `);
                console.log(`${chalk.magenta('\nIf the problem persists get in touch at support@mobiscroll.com.')}`);
                resolve();
            }
        })
    });
}

function notLoggedInFeedback() {
    printFeedback(`You are not logged in to the Mobiscroll npm registry ${useGlobalNpmrc ? 'globally' : 'locally'}!\n`);
    if (!useGlobalNpmrc) {
        console.log(`${chalk.yellow('Please Note:')} If you are logged in globally you will have to use the -g/--global flag with this command.\n\nUsage: ${chalk.gray('mobiscroll logout -g')}`);
    }
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
            notLoggedInFeedback();
        }
    } else {
        console.log(`No${useGlobalNpmrc ? ' global' : ' local'} .npmrc file found.`);
        notLoggedInFeedback();
    }
}

function handleScss() {
    useScss = true;
}

function handleCss() {
    useScss = false;
}

function handleProxy(url) {
    proxyUrl = url;
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

// function handleLazy() {
//     isLazy = true;
// }

function handleMobiscrollVersion(vers) {
    mobiscrollVersion = vers;
}

function handleStartIonicVersion(version) {
    startIoncVesrion = version;
}

function handleGlobalInstall() {
    useGlobalNpmrc = true;
}

function detectProjectFramework(packageJson, apiKey, isLite, projectType, useScss, version) {
    if (packageJson.dependencies) {
        if (packageJson.dependencies.vue) {
            helperMessages.vueHelp(projectType, apiKey, isLite, useScss, version);
            return 'vue';
        }

        if (packageJson.dependencies.react) {
            helperMessages.reactHelp(apiKey, isLite, isNpmSource, useScss, version);
            return "react";
        }
    }
    // TODO return guide to the default installation
    return;
}

function config(settings, callback) {
    var packageJson = settings.packageJson;

    if (!packageJson) {
        try {
            packageJson = require(settings.packageJsonLocation);
            settings.packageJson = packageJson;
        } catch (err) {
            utils.printError('Could not open package.json file.\n\n' + err);
        }
    }

    let projectType = settings.projectType;
    // settings.packageJson = packageJson;
    utils.checkMeteor(packageJson, settings.currDir, projectType);

    switch (projectType) {
        case 'angular':
            settings.isIonicApp = false;
            configAngular(settings, callback);
            break;
        case 'angularjs':
            break;
        case 'ionic':
            settings.isLazy = isLazy;
            configIonic(settings, callback);
            break;
        case 'react':
            helperMessages.reactHelp(settings.apiKey, settings.isLite, settings.isNpmSource, settings.useScss, settings.mobiscrollVersion);
            if (callback) {
                callback();
            }
            break;
        case 'jquery':
        case 'javascript':
            detectProjectFramework(settings.packageJson, settings.apiKey, settings.isLite, projectType, settings.useScss, settings.mobiscrollVersion);
            if (callback) {
                callback();
            }
            break;
    }

}

function cloneProject(url, type, framework, name, newAppLocation, gitOptions, callback) {
    utils.printLog(`Cloning ${type} starter app from git: ${url}`);

    clone(url, './' + name, gitOptions, () => {
        utils.printLog(`Repository cloned successfully.`);
        process.chdir(newAppLocation); // change directory to node modules folder
        console.log(`Installing dependencies may take several minutes:\n`);

        utils.run('npm install', true).then(() => {
            utils.checkMbscNpmLogin(isTrial, useGlobalNpmrc, proxyUrl, framework, mobiscrollVersion, (userName, useTrial) => {
                let configObject = {
                    projectType: type,
                    currDir: newAppLocation,
                    userName,
                    useTrial,
                    mobiscrollVersion,
                    proxyUrl
                };
                utils.installMobiscroll(configObject, () => {
                    if (callback) {
                        callback();
                    }
                });
            })
        });
    })
}

function askStyleSheetType(version, useScss, config, callback) {
    var skipQuestion = false;
    var localScss = undefined;
    var isIonic = config.projectType === 'ionic' && config.framework !== 'react';
    var globalScssPath = path.resolve(config.currDir, 'src', isIonic ? 'global.scss' : 'styles.scss');
    var isGlobalScss = fs.existsSync(globalScssPath);

    if (useScss === undefined && config.packageJson) {
        var isOldIonic = config.packageJson.dependencies && config.packageJson.dependencies['ionic-angular'] !== undefined; /* ionic version 2/3*/

        // ionic && angular cli
        if ((config.projectType === 'angular' || config.projectType === 'ionic') && !isOldIonic) {

            let checkStyleLoaded = isGlobalScss && fs.readFileSync(globalScssPath, 'utf8').toString();

            if (isGlobalScss && checkStyleLoaded && checkStyleLoaded.indexOf('mobiscroll') !== -1) {
                skipQuestion = true;
                localScss = true;
            } else {
                skipQuestion = !isGlobalScss; // only ask if the angular project was set up wiht scss
                localScss = false;
                if (isIonic && fs.existsSync(path.resolve(config.currDir, 'angular.json'))) {
                    checkStyleLoaded = fs.readFileSync(path.resolve(config.currDir, 'angular.json'), 'utf8').toString();
                    skipQuestion = checkStyleLoaded && checkStyleLoaded.indexOf('mobiscroll') !== -1;
                    localScss = false;
                }
            }
        }
    }

    // only ask the scss install if the version is larger then 4.7.0 
    if (semver.gte(version, '4.7.0') && useScss === undefined && !skipQuestion) { 
        let choices = ['CSS', 'SCSS'];
        console.log('\n');
        inquirer.prompt({
            type: 'list',
            name: 'stylesheet',
            message: `Which stylesheet format would you like to use?`,
            default: isIonic ? 'SCSS' : 'CSS',
            choices: isIonic ? choices.reverse() : choices

        }).then(answer => {
            if (callback) {
                callback(answer.stylesheet === 'SCSS');
            }
        })
    } else {
        if (callback) {
            callback(localScss || useScss);
        }
    }
}

function startProject(url, type, framework, name, gitOptions, callback) {

    printFeedback('Mobiscroll start command started.');

    var currDir = process.cwd(), // get the directory where the mobiscroll command was executed
        newAppLocation = path.resolve(currDir, name);

    if (fs.existsSync(newAppLocation)) {
        inquirer.prompt({
            type: 'input',
            name: 'confirm',
            message: `The directory .\\${chalk.gray(name)} exists. Would you like to overwrite the directory with this new project?(y/N)`,
            default: 'N',
        }).then(answer => {
            if (answer.confirm.toLowerCase() == 'y') {
                utils.deleteFolder(newAppLocation); // delete the app with the same name
                cloneProject(url, type, framework, name, newAppLocation, gitOptions, callback);
            } else {
                console.log(`Not erasing existing project in .\\${name}`);
                return;
            }
        })
        //return;
    } else {
        cloneProject(url, type, framework, name, newAppLocation, gitOptions, callback);
    }
}

function createProject(type, name) {
    switch (type) {
        case 'angular':
            startProject('https://github.com/acidb/angular-starter', type, 'angular', name, {}, () => {
                utils.testInstalledCLI('ng -v', 'npm install -g @angular/cli', 'ng serve -o', name, type);
            });
            break;
        case 'ionic-angular':
            if (startIoncVesrion && +startIoncVesrion === 4) {

                startProject('https://github.com/acidb/ionic-angular-starter', 'ionic', 'angular', name, {
                    checkout: 'v4'
                }, () => {
                    utils.testInstalledCLI('ionic -v', 'npm install -g ionic', 'ionic serve', name, type);
                });
            } else {
                startProject('https://github.com/acidb/ionic-angular-starter', "ionic", 'angular', name, {}, () => {
                    utils.testInstalledCLI('ionic -v', 'npm install -g @ionic/cli', 'ionic serve', name, type);
                });
            }
            break;
        case 'ionic-react':
            startProject('https://github.com/acidb/ionic-react-starter', "react", "react", name, {}, () => {
                utils.testInstalledCLI('ionic -v', 'npm install -g @ionic/cli', 'ionic serve', name, "react");
            });
            break;
        case 'ionic':
            startProject('https://github.com/acidb/ionic-starter', type, "angular", name, {}, () => {
                utils.testInstalledCLI('ionic -v', 'npm install -g ionic', 'ionic serve', name, type);
            });
            break;
        case 'react':
            startProject('https://github.com/acidb/react-starter', type, "react", name, {}, () => {
                utils.testInstalledCLI('create-react-app --version', 'npm install -g create-react-app', 'npm start', name, type);
            });
            break;
            // case 'vue':
            //     startProject('', type, name, () => {
            //         utils.testInstalledCLI('vue -V', 'npm install -g @vue/cli', 'npm run serve', name, type);
            //     });
            //     break;
        default:
            printWarning('No valid project type was specified. Currently the following project types are supported: [ angular, ionic, ionic-angular, ionic-react, react ]');
            break;
    }
}

function handleStart(type, name) {
    if (!name) {
        inquirer.prompt([{
            type: 'input',
            name: 'projectName',
            message: 'What would you like to name your project:',
            validate: function validateProjectName(name) {
                return name !== '';
            }
        }]).then((answer) => {
            createProject(type, answer.projectName);
        });
    } else {
        createProject(type, name);
    }
}

function handleConfig(projectType) {
    if (!projectType) {
        printWarning('Please specify the project type. [ionic, angular, angularjs, react, javascript, jquery] \n\nFor more information please run the ' + chalk.gray('mobiscroll config --help') + ' command.');
        return;
    }

    checkUpdate().then(() => {
        var framework = projectType,
            jsFileName = `@mobiscroll/angular${ isLite ? '-lite' : '' }`,
            cssFileName = `../node_modules/@mobiscroll/angular${ isLite ? '-lite' : '' }/dist/css/mobiscroll.min.css`,
            currDir = process.cwd(), // get the directory where the mobiscroll command was executed
            packageJsonLocation = path.resolve(currDir, 'package.json'),
            packageJson = '';

        // check if package.json is in the current directory
        if (!fs.existsSync(packageJsonLocation)) {
            printWarning('There is no package.json in this directory.\nPlease run this command in the project\'s root directory!');
            process.exit();
        }

        if (packageJsonLocation) {
            try {
                packageJson = require(packageJsonLocation);
            } finally {
                framework = projectType == 'ionic' ? (packageJson.dependencies['@ionic/react'] ? 'react' : 'angular') : projectType;
            }
        }

        printFeedback('Mobiscroll configuration started.');

        if (isLite) {
            utils.installMobiscrollLite(projectType, mobiscrollVersion, function () {
                let configObject = {
                    projectType,
                    currDir,
                    packageJsonLocation,
                    jsFileName,
                    cssFileName,
                    isNpmSource,
                    apiKey: '',
                    isLite,
                    useScss
                }

                config(configObject);
            })
        } else if (isNpmSource) {
            utils.checkMbscNpmLogin(isTrial, useGlobalNpmrc, proxyUrl, framework, mobiscrollVersion, (userName, useTrial, data) => {
                utils.removeUnusedPackages(projectType, packageJsonLocation, useTrial, false, () => {
                    let configObject = {
                        projectType,
                        currDir,
                        packageJsonLocation,
                        packageJson,
                        jsFileName,
                        cssFileName,
                        isNpmSource,
                        apiKey: (useTrial ? data.TrialCode : ''),
                        isLite,
                        useScss,
                        userName,
                        useTrial,
                        mobiscrollVersion,
                        proxyUrl,
                        framework
                    }

                    // Install mobiscroll npm package
                    utils.installMobiscroll(configObject, (version) => {
                        configObject.mobiscrollVersion = version;
                        askStyleSheetType(version, useScss, configObject, (isScssSelected) => {
                            configObject.useScss = isScssSelected;
                            config(configObject);
                        });
                    })
                });
            });
        } else {
            // if no-npm flag is set
            var files,
                localCssFileName = [],
                localJsFileName = [],
                esmBundleAvailable = false,
                // framework = projectType == 'ionic' ? ( packageJson.dependencies['@ionic/react'] ? 'react' : 'angular') : projectType,
                mbscFolderLocation = path.resolve(currDir, 'src', 'lib', 'mobiscroll'),
                jsFileLocation = path.resolve(mbscFolderLocation, 'js'),
                esmFileLocation = path.resolve(mbscFolderLocation, 'esm5'),
                cssFileLocation = path.resolve(mbscFolderLocation, 'css');

            utils.removeUnusedPackages(projectType, packageJsonLocation, false, false, () => {

                // check if mobiscroll js files are copied to the specific location and get the js file name
                if (fs.existsSync(jsFileLocation)) {
                    files = fs.readdirSync(jsFileLocation);
                    localJsFileName = files.filter(function (item) {
                        return item.match(/^mobiscroll\..*\.js$/);
                    });
                }

                // check if there's an esm bundle
                esmBundleAvailable = fs.existsSync(esmFileLocation);

                // check if css files are copied to the specific location and get the css file name
                if (fs.existsSync(cssFileLocation)) {
                    files = fs.readdirSync(cssFileLocation);
                    localCssFileName = files.filter(function (item) {
                        return item.match(/^mobiscroll\..*\.css$/);
                    });
                }

                if (!localJsFileName.length || !localCssFileName.length) {
                    printWarning(`No mobiscroll js/css files were found in your project's src/lib/mobiscroll folder. \n\nPlease make sure to extract the downloaded Mobiscroll package, then grab the ${ framework == 'angular' ? 'lib folder and copy it into src folder of your app!' : 'js and css folders and copy it into src/lib/mobiscroll folder of your app. If there is no such folder available, you can create it.' }`);
                    return;
                }

                var jsFileContent = (fs.readFileSync(path.resolve(jsFileLocation, localJsFileName.toString()).toString())).toString();
                var version = (/version:\s?['"]([a-z0-9.-]+)['"]/gmi.exec(jsFileContent))[1];
                let packageFolder = path.resolve(currDir, 'src', 'lib', 'mobiscroll-package');
                let distFolder = path.resolve(packageFolder, 'dist');

                mobiscrollVersion = version;

                // create new folders
                if (!fs.existsSync(packageFolder)) {
                    fs.mkdirSync(packageFolder, 0o777);
                    fs.mkdirSync(distFolder, 0o777);
                }

                let configObject = {
                    localCssFileName: localCssFileName[0],
                    localJsFileName: localJsFileName[0],
                    projectType,
                    currDir,
                    packageJsonLocation,
                    packageJson,
                    jsFileName,
                    isNpmSource,
                    apiKey: '',
                    isLite,
                    useScss,
                    framework,
                    mobiscrollVersion,
                }

                askStyleSheetType(version, useScss, configObject, (isScssSelected) => {
                    configObject.useScss = isScssSelected;

                    if (configObject.useScss) {
                        let scssFileLocation = path.resolve(cssFileLocation, `mobiscroll.${framework}.scss`);
                        let fileData = fs.readFileSync(scssFileLocation).toString();

                        if (fileData && framework === 'angular') {
                            fileData = fileData.replace("$mbsc-font-path: '' !default;", "$mbsc-font-path: '~@mobiscroll/angular/dist/css/' !default;");
                            utils.writeToFile(scssFileLocation, fileData)
                        }
                    }

                    // copy the mobiscroll resources to another folder for packing
                    ncp(mbscFolderLocation, path.resolve(distFolder), (err) => {
                        if (err) {
                            utils.printError('Could not copy Mobiscroll resources.\n\n' + err);
                            return;
                        }
                        var noNpmPackageJson = '';

                        try {
                            noNpmPackageJson = require(path.resolve(__dirname, 'resources', framework, 'pckg.json'));
                        } catch (err) {
                            utils.printError('Could not open package.json file.\n\n' + err);
                        }

                        console.log(`\n${chalk.green('>')} Mobiscroll resources were copied successfully.`);

                        // create the package.json file for the
                        noNpmPackageJson.version = version;
                        if (noNpmPackageJson.main) {
                            noNpmPackageJson.main = noNpmPackageJson.main + localJsFileName[0];
                        }
                        if (noNpmPackageJson.module) {
                            noNpmPackageJson.module = noNpmPackageJson.module + localJsFileName[0];
                        }
                        if (semver.gte(version, '5.0.0-beta6') && framework !== 'angular' && esmBundleAvailable) {
                            noNpmPackageJson.module = 'dist/esm5/' + localJsFileName[0];
                            if (noNpmPackageJson.files && noNpmPackageJson.files.length !== undefined) {
                                noNpmPackageJson.files.push('dist/esm5/**');
                            }
                        }

                        if (noNpmPackageJson.types) {
                            noNpmPackageJson.types = noNpmPackageJson.types + localJsFileName[0].replace('js', 'd.ts');
                        }
                        if (noNpmPackageJson.style) {
                            noNpmPackageJson.style = noNpmPackageJson.style + localCssFileName[0];
                        }

                        if (semver.gte(version, '5.0.0-beta') && framework !== 'angular') {
                            // typing location is different in v5 except angular
                            noNpmPackageJson.typings = "dist/src/" + framework + "/bundle.d.ts";
                        }

                        let useYarn = utils.testYarn(currDir);

                        // remove previously installed mobiscroll package (fix npm caching the local package)
                        utils.run(`${useYarn ? 'yarn remove' : 'npm uninstall'} @mobiscroll/${framework} --save`, true, true, true).then(() => {
                            utils.printLog('Removing old Mobiscroll version.');
                            // write the new package.json
                            utils.writeToFile(path.resolve(packageFolder, 'package.json'), JSON.stringify(noNpmPackageJson, null, 2), () => {
                                // pack with npm pack
                                utils.packMobiscroll(packageFolder, currDir, framework, useYarn, mobiscrollVersion, (packageName) => {
                                    var packageJson = '';
                                    try {
                                        packageJson = require(packageJsonLocation);
                                    } catch (err) {
                                        utils.printError('Could not open package.json file.\n\n' + err);
                                    }

                                    if (useYarn) {
                                        // workaround delete yarn cache tmp folder manually. Issue (https://github.com/yarnpkg/yarn/issues/5357)
                                        let yarnCacheLocation = utils.runSync('yarn cache dir');
                                        utils.deleteFolder(path.resolve(yarnCacheLocation.trim(), '.tmp'));
                                        utils.runSync(`yarn cache clean @mobiscroll/${framework}`);
                                    } else {
                                        packageJson.dependencies[`@mobiscroll/${framework}`] = 'file:./src/lib/mobiscroll-package/' + packageName;
                                    }

                                    utils.writeToFile(packageJsonLocation, JSON.stringify(packageJson, null, 4), () => {
                                        console.log(`${chalk.green('>')  + chalk.grey(' package.json')} modified to load mobiscroll from the generated package file. \n`);

                                        // run npm install
                                        utils.run((useYarn ? 'yarn add file:./src/lib/mobiscroll-package/' + packageName : 'npm install'), true).then(() => {
                                            cssFileName = (projectType == 'ionic' ? (packageJson.dependencies['@ionic/angular'] ? `./node_modules/@mobiscroll/${framework}/dist/css/` : 'lib/mobiscroll/css/') : `../node_modules/@mobiscroll/${framework}/dist/css/`) + localCssFileName;
                                            configObject.cssFileName = cssFileName;

                                            //config(projectType, currDir, packageJsonLocation, jsFileName, cssFileName, isNpmSource, false, false, () => {
                                            config(configObject, () => {
                                                console.log(`\n${chalk.green('>')} Removing unused mobiscroll files.`);
                                                fs.unlinkSync(path.resolve(packageFolder, 'package.json')); // delete the package.json in dist
                                                utils.deleteFolder(mbscFolderLocation); // delete source folder
                                                utils.deleteFolder(distFolder); // delete created dist
                                            });
                                        });
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
    utils.login(useGlobalNpmrc, proxyUrl);
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
    //.option('-l, --lazy', 'Skipping MbscModule injection from app.module.ts in case of Ionic lazy loading project.\n', handleLazy)
    .option('-t, --trial', 'The project will be tuned up with trial configuration.\n', handleTrial)
    .option('-i, --lite', 'The project will be tuned up with lite configuration.\n', handleLite)
    .option('-n, --no-npm', 'Mobiscroll resources won\'t be installed from npm. In this case the Mobiscroll resources must be copied manually to the src/lib folder.\n', handleNpmInstall)
    .option('--version [version]', `Pass the Mobiscroll version which you want to install. Supports the following formats: ${chalk.gray('--version=4.7.1')} or ${chalk.gray('--version=5')}\n`, handleMobiscrollVersion)
    .option('--proxy [proxy]', `Pass a proxy URL which will be passed to the internal requests. Supports the following formats: ${chalk.gray('{protocol}://{host}:{port} example: --proxy=http://myproxy.com:1122')} or with auth details ${chalk.gray('{protocol}://{user}:{password}@{host}:{port} example: --proxy=http://myuser:mypass@myproxy.com:1122')}`, handleProxy)
    .option('--scss', 'The project will be configured with scss styles instead of css.', handleScss)
    .option('--css', 'The project will be configured with css styles instead of scss.', handleCss);

program
    .command('login')
    .description('Logs you in to the Mobiscroll npm registry. (Use the --global flag if you want to login globally). \n')
    .action(handleLogin);

program
    .command('logout')
    .description('Logs you out from the Mobiscroll npm registry. (Use the --global flag if you want to log out globally).\n')
    .action(handleLogout);


program
    .command('start [types] [name]')
    .on('--help', helperMessages.startHelp)
    .option('-t, --trial', 'The project will be tuned up with trial configuration.\n', handleTrial)
    .option('--ionic-version [version]', `Pass the ionic-angular version of the starter app which you want to start. E.g ${chalk.gray('mobiscroll start ionic-angular --ionic-version=4')}`, handleStartIonicVersion)
    .description(`Creates a new Mobiscroll starter project and installs the Mobiscroll resources from npm.`)
    .action(handleStart)

program.on('command:*', function () {
    // warning on unknown commands
    printWarning(`Invalid command: ${chalk.green(program.args.join(' '))}`)
    console.error('\nSee --help for a list of available commands.');
    process.exit(1);
});

program.parse(process.argv);

// print help if no commands or options was passed
if (!program.args.length) {
    console.log(figlet.textSync('Mobiscroll CLI'));
    console.log('  Version: ' + localCliVersion);

    if (program.rawArgs.indexOf('-v') == -1) {
        program.help();
    }
}