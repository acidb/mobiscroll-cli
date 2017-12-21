const fs = require('fs');
const ncp = require('ncp').ncp;
const utils = require('./utils.js');
const chalk = require('chalk');

module.exports = {
    configIonicPro: function (currDir, packageJsonLocation, trial) {

        var mobisrollNpmFolder = currDir + '\\node_modules\\@mobiscroll\\angular' + (trial ? '-trial' : '') + '\\';
        var packageJson = require(packageJsonLocation);

        console.log('\n' + chalk.green('>') + ' Checking if @mobiscroll/angular is present in the node_modules folder.\n');
        if (fs.existsSync(mobisrollNpmFolder)) {

            // utils.printFeedback(`Running ${chalk.grey('npm pack')} command:`);

            utils.run('cd ' + mobisrollNpmFolder + ' && npm pack').then((arg) => {

                fs.readdir(mobisrollNpmFolder, function (err, files) {
                    var mbscPackage = files.filter((f) => {
                        return f.includes('mobiscroll-angular');
                    });

                    if (mbscPackage.length) {

                        ncp(mobisrollNpmFolder + mbscPackage[0], currDir + "\\" + mbscPackage[0], function (err) {
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

        } else {
            utils.printWarning(`There weren\'t any ${chalk.grey('@mobiscroll/angular')} folder in ${chalk.grey('node_modules')} directory. Please run ${chalk.grey('mobiscroll config ionic')} before running this command!`);
        }
    }
}