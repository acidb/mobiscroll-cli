const utils = require('./utils.js');
const fs = require('fs');
const chalk = require('chalk');
const path = require('path');

module.exports = {
    configAngular: function (currDir, packageJson, jsFileName, cssFileName, isIonicApp, isLite, callback) {
        if (!isIonicApp) {
            utils.printFeedback('Configuring Angular app...');
        }

        if (!utils.checkTypescriptVersion(packageJson)) {
            return;
        }

        var angularVersion = utils.shapeVersionToArray(packageJson.dependencies['@angular/common']);

        if (angularVersion[0] >= 6) { // check if angular 6 or newer
            // install rxjs-compat package
            utils.run('npm install rxjs-compat --save', true);
        }

        // Modify app.module.ts add necessary modules
        if (!utils.importModules(path.resolve(currDir + '/src/app/app.module.ts'), 'app.module.ts', jsFileName)) {
            // if not an angular-cli based app
            return;
        }

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

                // add angular module imports which are needed for mobiscroll
                data = data.replace('"styles": [', `"styles": [\n        "${cssFileName}",`);

                utils.writeToFile(currDir + '/.angular-cli.json', data);

                utils.printFeedback('Mobiscroll configuration ready.');
            });
        } else if (fs.existsSync(currDir + '/angular.json')) { // angular 6
            // starting from cli v6.0 the configuration file name and structure changed 
            var stylesArray,
                configPath,
                cssFile = cssFileName.replace('../', './'),
                ngConfig = require(currDir + '/angular.json'),
                projectName = Object.keys(ngConfig.projects)[0],
                projectConfig = ngConfig.projects[projectName];

            if (projectConfig.architect) {
                configPath = 'architect';
                stylesArray = projectConfig.architect.build.options.styles;
            } else if (projectConfig.targets) { // `architect` property is deprecated and `targets` will take it's place
                configPath = 'targets';
                stylesArray = projectConfig.targets.build.options.styles;
            } else {
                utils.printWarning('It looks like something changed in the angular.json configuration file. Couldn\'t locate the `styles` property. Skipping Mobiscroll stylesheet configuration.');
                console.log('You will have to add the stylesheet manually. Here is it\'s location: ' + chalk.grey(cssFile));
            }

            if (stylesArray) {
                stylesArray = stylesArray.filter(x => x != null && typeof x == "object" ? x.input && x.input.indexOf('mobiscroll') == -1 : x.indexOf('mobiscroll') == -1); // remove previously installed mobiscroll styles
                stylesArray.push(cssFile);
                ngConfig.projects[projectName][configPath].build.options.styles = stylesArray;
                utils.writeToFile(currDir + '/angular.json', JSON.stringify(ngConfig, null, 2));
            }
        } else {
            utils.printWarning(`The file ${chalk.grey('angular.json')} could not be found. If this is not an Angular CLI app, make sure to load ${chalk.grey(cssFileName)} into your app.`)
            utils.printFeedback('Mobiscroll configuration ready.');
        }

        if (callback) {
            callback();
        }
    }
}