const utils = require('./utils.js');
const fs = require('fs');
const chalk = require('chalk');

module.exports = {
    configAngular: function (currDir, packageJson, jsFileName, cssFileName) {
        utils.printFeedback('Configuring Angular app...');

        if (!utils.checkTypescriptVersion(packageJson.devDependencies.typescript)) {
            return;
        }

        // Modify app.module.ts add necesarry modules
        utils.importModules(currDir, jsFileName);

        console.log(`  Adding stylesheet to ${chalk.grey('angular.json')}`);

        if (fs.existsSync(currDir + '/.angular-cli.json')) {
            // Modify .angular-cli.json to load styles
            fs.readFile(currDir + '/.angular-cli.json', 'utf8', function (err, data) {
                if (err) {
                    utils.printError('There was an error during reading angular-cli.json. \n\nHere is the error message:\n\n' + err);
                    return;
                }

                // Remove old configuration
                data = data.replace(/"\.\.\/node_modules\/@mobiscroll\/angular(?:-trial)?(?:-lite)?\/dist\/css\/mobiscroll\.min\.css",\s*/, '');
                data = data.replace(/"\.\.\/node_modules\/mobiscroll-angular\/dist\/css\/mobiscroll\.min\.css",\s*/, '');
                data = data.replace(/"\.\.\/node_modules\/@mobiscroll\/angular\/dist\/css\/.+.css",\s*/, '');
                data = data.replace(/"lib\/mobiscroll\/css\/mobiscroll\..*\.css",\s*/, '');

                // add angular module imports which are needed for mobscroll
                data = data.replace('"styles": [', `"styles": [\n        "${cssFileName}",`);

                utils.writeToFile(currDir + '/.angular-cli.json', data);

                utils.printFeedback('Mobiscroll configuration ready.');
            });
        } else if (fs.existsSync(currDir + '/angular.json')) { // angular 6
            // starting from cli v6.0 the configuration file name and structure changed 
            var ngConfig = require(currDir + '/angular.json');
            var projectName = Object.keys(ngConfig.projects)[0],
                stylesArray = ngConfig.projects[projectName].architect.build.options.styles;

            if (stylesArray) {
                stylesArray = stylesArray.filter(x => x != null && typeof x == "object" ? x.input && x.input.indexOf('mobiscroll') == -1 : x.indexOf('mobiscroll') == -1); // remove previosly installed mobiscroll styles
                stylesArray.push(cssFileName.replace('../', './'));
                ngConfig.projects[projectName].architect.build.options.styles = stylesArray;
            }

            utils.writeToFile(currDir + '/angular.json', JSON.stringify(ngConfig, null, 2));

            // install rxjs-compat package
            utils.run('npm install rxjs-compat --save', true);
        } else {
            utils.printWarning(`The file ${chalk.grey('angular.json')} could not be found. If this is not an Angular CLI app, make sure to load ${chalk.grey(cssFileName)} into your app.`)
            utils.printFeedback('Mobiscroll configuration ready.');
        }
    }
}