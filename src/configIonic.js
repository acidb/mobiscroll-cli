const utils = require('./utils.js');
const fs = require('fs');
const ncp = require('ncp').ncp;
const chalk = require('chalk');

module.exports = {
    configIonic: function (currDir, packageJsonLocation, jsFileName, cssFileName, isNpmSource, apiKey) {
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

            // Modify app.module.ts add necesarry modules
            utils.importModules(currDir, jsFileName, apiKey);

            utils.printFeedback('Mobiscroll configuration ready!');
        }
    }
}