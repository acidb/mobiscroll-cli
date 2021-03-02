const utils = require('./utils.js');
const fs = require('fs');
const chalk = require('chalk');
const path = require('path');
var semver = require('semver');

function updateAngularJsonWithCss(settings) {
    var stylesArray,
        configPath,
        cssFile = settings.cssFileName.replace('../', './'),
        ngConfig = require(settings.currDir + '/angular.json'),
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

        if (!settings.useScss) {
            stylesArray.push(cssFile);
        }

        ngConfig.projects[projectName][configPath].build.options.styles = stylesArray;
        utils.writeToFile(settings.currDir + '/angular.json', JSON.stringify(ngConfig, null, 2), () => {
            if (settings.useScss === false) {
                updateGlobalScss(settings, ''); // remove previous scss config if it was present
            }
        });
    }

    utils.printFeedback('Mobiscroll configuration ready. Make sure to restart your app for changes to take effect!');
}

function updateGlobalScss(settings, data, updateCss) {
    const currDir = settings.currDir;
    const fileName = settings.isIonicApp ? 'global.scss' : 'styles.scss';
    const filePath = path.resolve(currDir, 'src', fileName);

    if (fs.existsSync(filePath)) {
        if (data) {
            console.log(`  Adding scss import to ${chalk.grey(fileName)}`);
        }
        utils.appendContentToFile(
            filePath,
            data,
            /@import "[\S]+mobiscroll[\S]+\.scss";/g,
            false,
            '',
            (err) => {
                if (err) {
                    utils.printError(`Couldn't update ${chalk.grey(fileName)}. Does your project is configured with scss?`);
                    return;
                }
                if (settings.useScss === true) {
                    updateAngularJsonWithCss(settings); // remove previous css config if it was present
                }
            }
        );
    } else {
        utils.printError(`Couldn't update ${chalk.grey(fileName)}. Does your project is configured with scss?`);
    }
}

function angularConfig(settings, callback) {
    // Modify app.module.ts add necessary modules
    const currDir = settings.currDir;

    if (!utils.importModules(path.resolve(currDir + '/src/app/app.module.ts'), 'app.module.ts', settings.jsFileName)) {
        // if not an angular-cli based app
        return;
    }

    if (settings.useScss) {
        updateGlobalScss(settings, `@import "~@mobiscroll/angular/dist/css/mobiscroll${ settings.isNpmSource ?  '' : '.angular'  }.scss";`);
    } else {
        console.log(`  Adding stylesheet to ${chalk.grey('angular.json')}`);
        if (fs.existsSync(path.resolve(currDir, '.angular-cli.json'))) {
            // Modify .angular-cli.json to load styles
            try {
                let data = fs.readFileSync(path.resolve(currDir, '.angular-cli.json'), 'utf8').toString();
                // Remove old configuration
                data = data.replace(/"\.\.\/node_modules\/@mobiscroll\/angular(?:-trial)?(?:-lite)?\/dist\/css\/mobiscroll\.min\.css",\s*/, '');
                data = data.replace(/"\.\.\/node_modules\/mobiscroll-angular\/dist\/css\/mobiscroll\.min\.css",\s*/, '');
                data = data.replace(/"\.\.\/node_modules\/@mobiscroll\/angular\/dist\/css\/.+.css",\s*/, '');
                data = data.replace(/"lib\/mobiscroll\/css\/mobiscroll\..*\.css",\s*/, '');

                // add angular module imports which are needed for mobiscroll
                data = data.replace('"styles": [', `"styles": [\n        "${settings.cssFileName}",`);

                utils.writeToFile(path.resolve(currDir, '.angular-cli.json'), data, () => {
                    if (settings.useScss === false) {
                        updateGlobalScss(settings, ''); // remove previous scss config if it was present
                    }
                });

                utils.printFeedback('Mobiscroll configuration ready. Make sure to restart your app for changes to take effect!');
            } catch (err) {
                utils.printError('There was an error during reading angular-cli.json. \n\nHere is the error message:\n\n' + err);
                return
            }
        } else if (fs.existsSync(currDir + '/angular.json')) { // angular 6
            // starting from cli v6.0 the configuration file name and structure changed 
            updateAngularJsonWithCss(settings);
        } else {
            utils.printWarning(`The file ${chalk.grey('angular.json')} could not be found. If this is not an Angular CLI app, make sure to load ${chalk.grey(settings.cssFileName)} into your app.`)
            utils.printFeedback('Mobiscroll configuration ready. Make sure to restart your app for changes to take effect!');
        }
    }

    if (callback) {
        callback();
    }
}

module.exports = {
    configAngular: function (settings, callback) {
        if (!settings.isIonicApp) {
            utils.printFeedback('Configuring Angular app...');
        }

        if (!utils.checkTypescriptVersion(settings.packageJson)) {
            return;
        }

        var angularVersion = utils.shapeVersionToArray(settings.packageJson.dependencies['@angular/common']);

        if (angularVersion[0] >= 6 && settings.mobiscrollVersion && semver.lt(settings.mobiscrollVersion, '4.8.2')) { // check if angular 6 or older than v4.8.2
            if (settings.packageJson.dependencies['rxjs-compat']) {
                utils.printFeedback('rxjs-compat package detected');
                angularConfig(settings, callback);
            } else {
                utils.run('npm install rxjs-compat --save', true).then(() => {
                    angularConfig(settings, callback);
                }).catch((err) => {
                    utils.printError('An error occurred during the project configuration. Error: ' + err);
                })
            }
        } else {
            angularConfig(settings, callback);
        }
    }
}