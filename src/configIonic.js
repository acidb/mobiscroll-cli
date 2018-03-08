const utils = require('./utils.js');
const fs = require('fs');
const ncp = require('ncp').ncp;
const chalk = require('chalk');
const path = require('path');
const helperMessages = require('./helperMessages.js');

function configIonicPro(currDir, packageJson, packageJsonLocation, trial) {
    var mobisrollNpmFolder = path.join(currDir, 'node_modules', '@mobiscroll', 'angular' + (trial ? '-trial' : ''));

    process.chdir(mobisrollNpmFolder); // change directory to node modules folder

    console.log(`\n${chalk.green('>')} changed current directory to node_modules/@mobiscroll/angular \n`);

    utils.run('npm pack').then(() => { // run npm pack which will generate the mobiscroll package
        fs.readdir(mobisrollNpmFolder, function (err, files) {
            var mbscPackage = files.filter((f) => {
                // return the full name of the generated package
                return f.includes('mobiscroll-angular');
            });

            if (mbscPackage.length) {
                // copy the generated package to the rootfolder
                ncp(path.join(mobisrollNpmFolder, mbscPackage[0]), path.join(currDir, mbscPackage[0]), function (err) {
                    if (err) {
                        utils.printError('Could not copy generated mobiscroll package.\n\n' + err);
                        return;
                    }

                    console.log('\n' + chalk.green('>') + ' ' + mbscPackage[0] + ' copied to the root folder.\n');
                    packageJson.dependencies['@mobiscroll/angular' + (trial ? '-trial' : '')] = "file:./" + mbscPackage[0];
                    utils.writeToFile(packageJsonLocation, JSON.stringify(packageJson, null, 4));
                    console.log(`${chalk.green('>')  + chalk.grey(' package.json')} modified to load mobiscroll form the generated tzg file. \n`);

                    // set the current durectory back to the default
                    process.chdir(currDir);
                    // run npm install
                    utils.run('npm install').then(() => {
                        utils.printFeedback(`Mobiscroll ionic-pro configuration ready!`);
                    });

                });
            }

        });
    });
}
module.exports = {
    configIonic: function (currDir, ionicPackageLocation, jsFileName, cssFileName, isNpmSource, apiKey, isLazy, ionicPro, isLite) {
        utils.printFeedback('Configuring Ionic app...');
        var ionicPackage = require(ionicPackageLocation);
        // if it is an ionic project(has ionic-angular package between dependecies)
        if (ionicPackage && ionicPackage.dependencies['ionic-angular']) {

            console.log(`  Adding stylesheet copy script to ${chalk.grey('package.json')}`);

            // Add ionic_copy script to package.json and copy the scrips folder
            ionicPackage.config = ionicPackage.config || {};

            console.log(`  Copying scripts`);

            ionicPackage.config['ionic_copy'] = './scripts/copy-mobiscroll-css' + (isNpmSource || isLite ? '-npm' : '') + (apiKey ? '-trial' : '') + '.js';
            utils.writeToFile(ionicPackageLocation, JSON.stringify(ionicPackage, null, 4));

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

                if (isNpmSource || isLite) {
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
                utils.importModules(currDir, jsFileName);
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
    }
}