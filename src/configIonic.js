const utils = require('./utils.js');
const fs = require('fs');
const ncp = require('ncp').ncp;
const chalk = require('chalk');
const path = require('path');
const helperMessages = require('./helperMessages.js');
const inquirer = require('inquirer');
const configAngular = require('./configAngular').configAngular;

function configIonicPro(currDir, packageJson, packageJsonLocation) {
    var mobiscrollNpmFolder = path.join(currDir, 'node_modules', '@mobiscroll', 'angular');

    utils.printFeedback(`The Mobiscroll package will be referenced in the package.json as a tgz file instead of the npm package. \n\nYou will find more info here: ${chalk.grey('http://help.mobiscroll.com/core-concepts-and-using-mobiscroll/using-mobiscroll-with-ionic-pro-and-ionic-view')}`);

    utils.packMobiscroll(mobiscrollNpmFolder, currDir, 'angular', (packageFileName) => {
        ncp(path.join(mobiscrollNpmFolder, packageFileName), path.join(currDir, packageFileName), function (err) {
            if (err) {
                utils.printError('Could not copy generated mobiscroll package.\n\n' + err);
                return;
            }

            console.log('\n' + chalk.green('>') + ' ' + packageFileName + ' copied to the root folder.\n');

            packageJson.dependencies['@mobiscroll/angular'] = "file:./" + packageFileName;

            utils.writeToFile(packageJsonLocation, JSON.stringify(packageJson, null, 4), () => {
                console.log(`${chalk.green('>')  + chalk.grey(' package.json')} modified to load mobiscroll from the generated tzg file. \n`);

                // run npm install
                utils.run('npm install', true).then(() => {
                    utils.printFeedback(`Mobiscroll ionic-pro configuration ready!`);
                });
            });
        });
    });
}

function configIonic(ionicPackage, ionicPackageLocation, currDir, cssFileName, jsFileName, isNpmSource, isLite, isLazy, apiKey, ionicPro, ionicVersion) {
    console.log(`\n  Adding stylesheet copy script to ${chalk.grey('package.json')}`);

    // Add ionic_copy script to package.json and copy the scrips folder
    ionicPackage.config = ionicPackage.config || {};

    console.log(`  Copying scripts`);

    var ionicCopyLocation = ionicPackage.config['ionic_copy'];

    if (!ionicCopyLocation) {
        // if there is no ionic_copy defined add the copy script and inject to the package.json

        ionicPackage.config['ionic_copy'] = './scripts/copy-mobiscroll-css.js';

        utils.writeToFile(ionicPackageLocation, JSON.stringify(ionicPackage, null, 4));

        ncp(__dirname + '/../resources/ionic/scripts', currDir + '/scripts', function (err) {
            if (err) {
                utils.printError('Could not copy mobiscroll resources.\n\n' + err);
                return;
            }
        });
    } else {
        // if the ionic_copy is already used update the specific script with mobiscroll copy
        var copyScriptLocation = path.resolve(currDir, ionicCopyLocation);

        fs.readFile(copyScriptLocation, (err, data) => {
            if (err) {
                utils.printError('Could not read ionic_copy script.\n\n' + err);
                return;
            }

            if (data.toString().indexOf('copyMobiscrollCss') == -1) {
                data = data.toString().replace(
                    'module.exports = {',
                    `module.exports = {
  copyMobiscrollCss: {
    src: [${ isLite ?  '\'{{ROOT}}/node_modules/@mobiscroll/angular-lite/dist/css/*\'' : '\'{{ROOT}}/node_modules/@mobiscroll/angular/dist/css/*\'' }],
    dest: '{{WWW}}/lib/mobiscroll/css/'
  },`
                );

                utils.writeToFile(copyScriptLocation, data);
            }
        })
    }

    console.log(`  Loading stylesheet in ${chalk.grey('src/index.html')}`);

    // Load css in the index.html
    fs.readFile(currDir + '/src/index.html', 'utf8', function (err, data) {
        if (err) {
            utils.printError('Could not read index.html \n\n' + err);
            return;
        }

        if (isNpmSource || isLite) {
            cssFileName = 'lib/mobiscroll/css/mobiscroll.min.css';
        }

        // replace previously added links
        data = data.replace(/<link rel="stylesheet" href=".*mobiscroll.*">\s+/, '');

        if (data.indexOf(cssFileName) == -1) {
            data = data.replace(/<link ([^>]+) rel="stylesheet">/, function (match) {
                return '<link rel="stylesheet" title="' + cssFileName + '">\n  ' + match;
            });

            utils.writeToFile(currDir + '/src/index.html', data);
        }
    });

    if (isLazy) {
        utils.printFeedback(`Lazy mode: skipping MbscModule injection from app.module.ts`);
    } else {
        // Modify app.module.ts add necessary modules
        utils.importModules(path.resolve(currDir + '/src/app/app.module.ts'), 'app.module.ts', jsFileName);
    }

    if (ionicPro) {
        configIonicPro(currDir, ionicPackage, path.resolve(process.cwd(), 'package.json'), apiKey);
    } else {
        utils.printFeedback('Mobiscroll configuration ready!');
    }

    if (isLazy) {
        helperMessages.ionicLazy(apiKey, isLite);
    }
}

function detectLazyModules(currDir, apiKey, isLite, jsFileName, ionicVersion) {

    var ngAppPath = path.resolve(currDir, (ionicVersion >= 4 ? 'src/app' : 'src/pages'));

    // look for directories in the app folder
    var ngModulesDir = fs.readdirSync(ngAppPath).filter((f) => {
        return fs.lstatSync(path.resolve(ngAppPath, f)).isDirectory();
    })
    
    // check for *.module.ts

    var modulePages = [];

    for (var i = 0; i < ngModulesDir.length; ++i) {
        let checkModule = fs.readdirSync(path.resolve(ngAppPath, ngModulesDir[i])).filter(f => f.indexOf('.module.ts') != -1 )
        if (checkModule.length) {
            modulePages.push({
                name: ngModulesDir[i] + ' - ' + checkModule[0]
            });
        }
    }

    if (modulePages.length) {
        console.log(chalk.bold(`\nMultiple angular modules detected. The MbscModule should be imported into every module separately where you want to use the Mobiscroll components:\n`));

        inquirer.prompt([
            {
            type: 'checkbox',
            message: 'Where to inject MbscModule?',
            name: 'pages',
            choices: modulePages
            }
        ]).then(function (answers) {
            if (answers.pages.length) {
                for (let i = 0; i <answers.pages.length; ++i) {
                    let pageInfo = answers.pages[i].split(' - ');
                    utils.importModules(path.resolve(ngAppPath, pageInfo[0], pageInfo[1]), pageInfo[1], jsFileName);
                }

                utils.printFeedback('MbscModule injected successfully to the selected pages.');
            } else {
                // didn't selected any options
                helperMessages.ionicLazy(apiKey, isLite);
            }
        });

        return true;
    }

    return false;

}

module.exports = {
    configIonic: function (currDir, ionicPackageLocation, jsFileName, cssFileName, isNpmSource, apiKey, isLazy, ionicPro, isLite) {
        utils.printFeedback('Configuring Ionic app...');
        var versionArray,
            mainIonicVersion,
            ionicPackage = require(ionicPackageLocation),
            ionicVersion = ionicPackage.dependencies['ionic-angular'] || ionicPackage.dependencies['@ionic/angular'];

        if (ionicVersion) { // check ionic version
            versionArray = utils.shapeVersionToArray(ionicVersion);

            mainIonicVersion = versionArray[0];

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

        console.log('ionicVersion ==>', ionicVersion);
        if (ionicVersion && mainIonicVersion >= 4) {
            configAngular(currDir, ionicPackage, jsFileName, cssFileName, true);
        } else {
            configIonic(ionicPackage, ionicPackageLocation, currDir, cssFileName, jsFileName, isNpmSource, isLite, isLazy, apiKey, ionicPro, mainIonicVersion);
        }
        
        detectLazyModules(currDir, apiKey, isLite, jsFileName, mainIonicVersion);

        // TODO: check if --no-npm work with ionic 4 !!!!
    }
}