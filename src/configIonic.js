const utils = require('./utils.js');
const fs = require('fs');
const ncp = require('ncp').ncp;
const chalk = require('chalk');
const path = require('path');

function configIonicPro(currDir, packageJson, packageJsonLocation, trial) {
    var mobisrollNpmFolder = path.join(currDir, 'node_modules', '@mobiscroll', 'angular' + (trial ? '-trial' : ''));

    utils.run('cd ' + mobisrollNpmFolder + ' && npm pack').then((arg) => {
        fs.readdir(mobisrollNpmFolder, function (err, files) {
            var mbscPackage = files.filter((f) => {
                return f.includes('mobiscroll-angular');
            });

            if (mbscPackage.length) {

                ncp(path.join(mobisrollNpmFolder, mbscPackage[0]), path.join(currDir, mbscPackage[0]), function (err) {
                    if (err) {
                        utils.printError('Could not copy generated mobiscroll package.\n\n' + err);
                        return;
                    }

                    console.log('\n' + chalk.green('>') + ' ' + mbscPackage[0] + ' copied to the root folder.\n');
                    packageJson.dependencies['@mobiscroll/angular' + (trial ? '-trial' : '')] = "file:./" + mbscPackage[0];
                    utils.writeToFile(packageJsonLocation, JSON.stringify(packageJson, null, 4));
                    console.log(`${chalk.green('>')  + chalk.grey(' package.json')} modified to load mobiscroll package form the generated tzg file. `);
                    utils.printFeedback(`Mobiscroll ionic-pro configuration ready!`);
                });
            }

        });

    });
}

module.exports = {
    configIonic: function (currDir, packageJsonLocation, jsFileName, cssFileName, isNpmSource, apiKey, isLazy, ionicPro) {
        utils.printFeedback('Configuring Ionic app...');

        var ionicPackage = require(packageJsonLocation);

        // if it is an ionic project(has ionic-angular package between dependecies)
        if (ionicPackage && ionicPackage.dependencies['ionic-angular']) {

            console.log(`  Adding stylesheet copy script to ${chalk.grey('package.json')}`);

            // Add ionic_copy script to package.json and copy the scrips folder
            ionicPackage.config = ionicPackage.config || {};

            if (!apiKey && ionicPackage.dependencies['@mobiscroll/angular-trial']) {
                // Remove mobiscroll-trial package form package.json if the licenced version is installed
                delete ionicPackage.dependencies['@mobiscroll/angular-trial'];
            } else if (apiKey && ionicPackage.dependencies['@mobiscroll/angular']) {
                // Remove mobiscroll package form package.json if the trial version is installed
                delete ionicPackage.dependencies['@mobiscroll/angular'];
            }

            console.log(`  Copying scripts`);

            ionicPackage.config['ionic_copy'] = './scripts/copy-mobiscroll-css' + (isNpmSource ? '-npm' : '') + (apiKey ? '-trial' : '') + '.js';
            utils.writeToFile(packageJsonLocation, JSON.stringify(ionicPackage, null, 4));

            ncp(__dirname + '/../resources/ionic/scripts', currDir + '/scripts', function (err) {
                if (err) {
                    utils.printError('Could not copy mobiscroll resources.\n\n' + err);
                    return;
                }
            });

            console.log(`  Loading stylesheet in ${chalk.grey('src/index.html')}`);

            // Load css in the index.html
            fs.readFile(currDir + '/src/index.html', 'utf8', function (err, data) {
                if (err) {
                    utils.printError('Could not read index.html \n\n' + err);
                    return;
                }

                if (isNpmSource) {
                    cssFileName = 'lib/mobiscroll/css/mobiscroll.min.css';
                }

                if (data.indexOf(cssFileName) == -1) {
                    data = data.replace(/<link ([^>]+) rel="stylesheet">/, function (match) {
                        return '<link rel="stylesheet" href="' + cssFileName + '">\n  ' + match;
                    });

                    utils.writeToFile(currDir + '/src/index.html', data);
                }
            });

            if (isLazy) {
                utils.printFeedback(`Lazy mode: skipping MbscModule injection from app.module.ts`);
            } else {
                // Modify app.module.ts add necesarry modules
                utils.importModules(currDir, jsFileName, apiKey);
            }

            if (ionicPro) {
                configIonicPro(currDir, ionicPackage, packageJsonLocation, apiKey);
            } else {
                utils.printFeedback('Mobiscroll configuration ready!');
            }

            if (isLazy) {
                console.log(`\nIf you are using ionic lazy loading you'll have to manually include the MbscModule and FormsModule into the page's module.ts file where you'll be using Mobiscroll.\n\nExample:\n`);
                console.log("    import { MbscModule } from '@mobiscroll/angular" + (apiKey ? '-trial' : '') + "'");
                console.log("    import { FormsModule } from '@angular/forms';\n");
                console.log("    @NgModule({");
                console.log("        imports: [");
                console.log("            // leave the other imports as they are");
                console.log("            // ... ");
                console.log("            MbscModule, // add the mobiscroll module");
                console.log("            FormsModule // add the forms module");
                console.log("        ],");
                console.log("        declarations: // ...");
            }
        }
    }
}