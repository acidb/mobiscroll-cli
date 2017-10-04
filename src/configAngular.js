const utils = require('./utils.js');
const fs = require('fs');
const chalk = require('chalk');

module.exports = {
    configAngular: function (currDir, packageJsonLocation, jsFileName, cssFileName, isNpmSource, apiKey) {
        utils.printFeedback('Configuring Angular app...');

        // Modify app.module.ts add necesarry modules
        utils.importModules(currDir, jsFileName, apiKey);

        console.log(`  Adding stylesheet to ${chalk.grey('angular-cli.json')}`);

        if (fs.existsSync(currDir + '/.angular-cli.json')) {
            // Modify .angular-cli.json to load styles
            fs.readFile(currDir + '/.angular-cli.json', 'utf8', function (err, data) {
                if (err) {
                    utils.printError('There was an error during reading angular-cli.json. \n\nHere is the error message:\n\n' + err);
                    return;
                }

                // Remove old configuration
                data = data.replace(/"\.\.\/node_modules\/@mobiscroll\/angular(?:-trial)?\/dist\/css\/mobiscroll\.min\.css",\s*/, '');
                data = data.replace(/"lib\/mobiscroll\/css\/mobiscroll\..*\.css",\s*/, '');

                // add angular module imports which are needed for mobscroll
                data = data.replace('"styles": [', `"styles": [\n        "${cssFileName}",`);

                utils.writeToFile(currDir + '/.angular-cli.json', data);

                utils.printFeedback('Mobiscroll configuration ready.');
            });
        } else {
            utils.printWarning(`The file ${chalk.grey('angular-cli.json')} could not be found. If this is not an Angular CLI app, make sure to load ${chalk.grey(cssFileName)} into your app.`)
            utils.printFeedback('Mobiscroll configuration ready.');
        }
    }
}