const utils = require('./utils.js');
const fs = require('fs');
const ncp = require('ncp').ncp;
const chalk = require('chalk');
const path = require('path');
const helperMessages = require('./helperMessages.js');
const inquirer = require('inquirer');
const configAngular = require('./configAngular').configAngular;

function updateCssCopy(settings, ionicPackage) {
    // if there is no ionic_copy defined add the copy script and inject to the package.json
    ionicPackage.config['ionic_copy'] = './scripts/copy-mobiscroll-css.js';
    utils.writeToFile(settings.packageJsonLocation, JSON.stringify(ionicPackage, null, 4));

    ncp(__dirname + '/../resources/ionic/scripts', path.resolve(settings.currDir, 'scripts'), function (err) {
        if (err) {
            utils.printError('Could not copy mobiscroll resources.\n\n' + err);
            return;
        }
    });
}

function configIonic(settings, callback) {
    let ionicPackage = settings.packageJson;
    let currDir = settings.currDir;

    // Add ionic_copy script to package.json and copy the scrips folder
    ionicPackage.config = ionicPackage.config || {};

    var ionicCopyLocation = ionicPackage.config['ionic_copy'];

    if (settings.useScss) {
        let fileName = 'variables.scss'
        console.log(`  Adding scss stylesheet to ${chalk.grey(fileName)}`);
        utils.appendContentToFile(
            path.resolve(currDir, 'src/theme', fileName),
            `$mbsc-font-path: '../lib/mobiscroll/css/';
@import "../../node_modules/@mobiscroll/angular/dist/css/mobiscroll${ settings.isNpmSource ? '' : '.angular' }.scss";`,
            '',
            false,
            /(\$mbsc-font-path: '..\/lib\/mobiscroll\/css\/';[\s\S]+)?@import "[\S]+mobiscroll[\S]+\.scss";/gm,
            (err) => {
                if (err) {
                    utils.printError(`Couldn't update ${chalk.grey(fileName)}. Does your project is configured with sass?`);
                    return;
                }
            }
        );
    } else {
        console.log(`\n  Adding stylesheet copy script to ${chalk.grey('package.json')}`);
        console.log(`  Copying scripts`);
    }

    if (!ionicCopyLocation) {
        updateCssCopy(settings, ionicPackage);
    } else {
        // if the ionic_copy is already used update the specific script with mobiscroll copy
        var copyScriptLocation = path.resolve(currDir, ionicCopyLocation);
        let copyScript = require(copyScriptLocation);

        if (Object.keys(copyScript).length === 1 && copyScript['copyMobiscrollCss']) {
            fs.unlinkSync(copyScriptLocation);
            delete ionicPackage.config['ionic_copy'];
            updateCssCopy(settings, ionicPackage);

        } else {
            delete copyScript['copyMobiscrollCss'];

            copyScript['copyMobiscrollCss'] = {
                src: [`${ settings.isLite ?  '{{ROOT}}/node_modules/@mobiscroll/angular-lite/dist/css/*' : '{{ROOT}}/node_modules/@mobiscroll/angular/dist/css/*' }`],
                dest: '{{WWW}}/lib/mobiscroll/css/'
            }

            utils.writeToFile(copyScriptLocation, 'module.exports = ' + JSON.stringify(copyScript, null, 4))
        }
    }

    console.log(`  Loading stylesheet in ${chalk.grey('src/index.html')}`);

    // Load css in the index.html
    try {
        let data = fs.readFileSync(currDir + '/src/index.html', 'utf8');

        if (settings.isNpmSource || settings.isLite) {
            settings.cssFileName = 'lib/mobiscroll/css/mobiscroll.min.css';
        }

        // replace previously added links
        data = data.replace(/<link rel="stylesheet" href=".*mobiscroll.*">\s+/, '');

        if (data.indexOf(settings.cssFileName) == -1 && !settings.useScss) {
            data = data.replace(/<link ([^>]+) rel="stylesheet">/, function (match) {
                return '<link rel="stylesheet" href="' + settings.cssFileName + '">\n  ' + match;
            });
        }

        utils.writeToFile(currDir + '/src/index.html', data);
    } catch (err) {
        utils.printError('Could not read index.html \n\n' + err);
        return;
    }

    if (settings.isLazy) {
        utils.printFeedback(`Lazy mode: skipping MbscModule injection from app.module.ts`);
    } else {
        // Modify app.module.ts add necessary modules
        utils.importModules(path.resolve(currDir + '/src/app/app.module.ts'), 'app.module.ts', settings.jsFileName);
    }

    utils.printFeedback('Mobiscroll configuration ready!');

    if (settings.isLazy) {
        helperMessages.ionicLazy(settings.apiKey, settings.isLite);
    }

    if (callback) {
        callback();
    }
}

function detectReactPages(settings/*, callback*/) {
    // let pages = [],
    const pagesPath = path.resolve(settings.currDir, 'src', 'pages');

    if (fs.existsSync(pagesPath)) {
        // pages = fs.readdirSync(pagesPath).filter((f) => {
        //     return path.extname(f) == '.tsx';
        // })

        console.log(chalk.bold(`\n\nMultiple pages detected. Mobiscroll components must be imported into every page separately where you want to use the components. You can import the component the following way:`));

        helperMessages.reactHelp(settings.apiKey, settings.isLite, settings.isNpmSource, settings.useScss, settings.mobiscrollVersion);
        // if (pages.length) {
        //     console.log(chalk.bold(`\n\nMultiple pages detected. Mobiscroll components must be imported into every module separately where you want to use Mobiscroll components. Would you like us to inject Eventcalendar import for you?\n`));
        //     inquirer.prompt([{
        //         type: 'checkbox',
        //         message: 'Please select where else do you want to inject mobiscroll import? ',
        //         name: 'pages',
        //         choices: pages
        //     }]).then(function (answers) {
        //         if (answers.pages.length) {
        //             console.log('\n');
        //             for (let i = 0; i < answers.pages.length; ++i) {
        //                 let filePath = path.resolve(pagesPath, answers.pages[i]);
        //                 if (fs.existsSync(filePath)) {}
        //                 utils.appendContentToFile(
        //                     filePath,
        //                     `import ${semver.gte(settings.mobiscrollVersion, '5.0.0-beta') ? '* as' : ''} mobiscroll from '@mobiscroll/react';`,
        //                     /import.*'@mobiscroll\/react';/gm,
        //                     true,
        //                     '',
        //                     (err) => {
        //                         if (err) {
        //                             utils.printError(`Couldn't update the following file ${ answers.pages[i]}`);
        //                             return;
        //                         }
        //                     }
        //                 )
        //             }

        //             utils.printFeedback('Mobiscroll injected successfully to the selected pages.');

        //             if (callback) {
        //                 callback();
        //             }
        //         }

        //     });

        //     return true;
        // }
    }

}

function detectLazyModules(currDir, apiKey, isLite, jsFileName, ionicVersion, callback) {

    var modulePages = [],
        ngAppPath = path.resolve(currDir, (ionicVersion >= 4 ? 'src/app' : 'src/pages'));


    if (fs.existsSync(ngAppPath)) {
        // look for directories in the app folder
        var ngModulesDir = fs.readdirSync(ngAppPath).filter((f) => {
            return fs.lstatSync(path.resolve(ngAppPath, f)).isDirectory();
        })

        // check for *.module.ts files 
        for (var i = 0; i < ngModulesDir.length; ++i) {
            let checkModule = fs.readdirSync(path.resolve(ngAppPath, ngModulesDir[i])).filter(f => f.indexOf('.module.ts') !== -1);
            if (checkModule.length) {
                for (let m = 0; m < checkModule.length; ++m) {
                    modulePages.push({
                        name: ngModulesDir[i] + ' - ' + checkModule[m]
                    });
                }
            }
        }

        if (modulePages.length) {
            console.log(chalk.bold(`\n\nMultiple angular modules detected. The ${chalk.grey('MbscModule')} and ${chalk.grey('FormsModule')} must be imported into every module separately where you want to use Mobiscroll components. Would you like us to inject the MbscModule for you?\n`));
            console.log(`The ${chalk.grey('MbscModule')} is already injected to the ${chalk.grey('app.module.ts')}.\n`)

            inquirer.prompt([{
                type: 'checkbox',
                message: 'Please select where else do you want to inject the MbscModule? ',
                name: 'pages',
                choices: modulePages
            }]).then(function (answers) {
                if (answers.pages.length) {
                    console.log('\n');
                    for (let i = 0; i < answers.pages.length; ++i) {
                        let pageInfo = answers.pages[i].split(' - ');
                        utils.importModules(path.resolve(ngAppPath, pageInfo[0], pageInfo[1]), pageInfo[1], jsFileName);
                    }

                    utils.printFeedback('MbscModule injected successfully to the selected modules.');

                    if (callback) {
                        callback();
                    }
                }

                helperMessages.ionicLazy(apiKey, isLite);
            });

            return true;
        }
    }

    if (callback) {
        callback();
    }

    return false;
}

module.exports = {
    configIonic: function (settings, callback) {
        utils.printFeedback('Configuring Ionic app...');
        var versionArray,
            mainIonicVersion,
            ionicPackage = settings.packageJson, //require(settings.ionicPackageLocation),
            ionicVersion = ionicPackage.dependencies['ionic-angular'] || ionicPackage.dependencies['@ionic/angular'],
            ionicReactVersion = ionicPackage.dependencies['@ionic/react'];

        if (ionicReactVersion) {
            if (settings.useScss) {
                let fileName = 'variables.scss'
                console.log(`  Adding scss stylesheet to ${chalk.grey(fileName)}`);
                utils.appendContentToFile(
                    path.resolve(settings.currDir, 'src', 'theme', fileName),
                    `@import "@mobiscroll/react/dist/css/${ settings.isNpmSource ?  'mobiscroll.scss' : settings.localCssFileName.replace('min.css', 'scss')  }";`,
                    /@import "[\S]+mobiscroll[\S]+\.scss";/g,
                    false,
                    '',
                    (err) => {
                        if (err) {
                            utils.printError(`Couldn't update ${chalk.grey(fileName)}. Does your project is configured with scss?`)
                            return;
                        }
                    }
                );
            } else {
                let appFile = path.resolve(settings.currDir, 'src', 'App.tsx');

                let appFileData = fs.readFileSync(appFile, 'utf8');

                if (appFileData) {
                    console.log(`  Adding css stylesheet to ${chalk.grey('app.tsx')}`);

                    //if (appFileData.indexOf(settings.cssFileName) == -1) {
                    appFileData = appFileData.replace(/import '@mobiscroll.*css';\s?/gm, '');
                    //}

                    appFileData = appFileData.replace(`import '@ionic/react/css/core.css';`, `import '@ionic/react/css/core.css';\n\rimport '@mobiscroll/react/dist/css/${ settings.isNpmSource ?  'mobiscroll.min.css' : settings.localCssFileName  }';\n\r`);
                    utils.writeToFile(appFile, appFileData);
                }
            }

            detectReactPages(settings, () => {
                if (callback) {
                    callback()
                }
            })

        } else {
            if (ionicVersion) { // check ionic version
                versionArray = utils.shapeVersionToArray(ionicVersion);

                mainIonicVersion = versionArray[0];
                settings.mainIonicVersion = mainIonicVersion;

                if (mainIonicVersion == 2 && versionArray[1] < 2) {
                    utils.printWarning('It looks like your are using an older version of ionic 2. The minimum required ionic 2 version is 2.2.0. Please update your ionic app in order to Mobiscroll work correctly.');

                    return;
                }
            } else if (ionicPackage.devDependencies['gulp']) { // check if ionic 1.x where gulp is used
                utils.printWarning('It looks like you are trying to run this command in an ionic 1 application. The `mobiscroll config ionic` supports only ionic 2+ apps. Please run `mobiscroll config --help` for more information.')
                return;
            }

            if (!utils.checkTypescriptVersion(ionicPackage)) {
                return;
            }

            settings.ionicVersion = mainIonicVersion;

            if (ionicVersion && mainIonicVersion >= 4) {
                settings.isIonicApp = true;
                configAngular(settings, () => {
                    detectLazyModules(settings.currDir, settings.apiKey, settings.isLite, settings.jsFileName, mainIonicVersion, callback);
                });
            } else {
                //configIonic(ionicPackage, ionicPackageLocation, currDir, cssFileName, jsFileName, isNpmSource, isLite, isLazy, apiKey, ionicPro, () => {
                configIonic(settings, () => {
                    detectLazyModules(settings.currDir, settings.apiKey, settings.isLite, settings.jsFileName, mainIonicVersion, callback);
                });
            }
        }
    }
}