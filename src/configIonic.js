const utils = require('./utils.js');
const fs = require('fs');
const ncp = require('ncp').ncp;

module.exports = {
    configIonic: function (currDir, packageJsonLocation, jsFileName, cssFileName, isNpmSource, apiKey) {
        var ionicPackage = require(packageJsonLocation);

        // if it is an ionic project(has ionic-angular package between dependecies)
        if (ionicPackage && ionicPackage.dependencies['ionic-angular']) {

            // Add ionic_copy script to package.json and copy the scrips folder
            ionicPackage.config = ionicPackage.config || {};

            ionicPackage.config['ionic_copy'] = './scripts/copy-mobiscroll-css' + (isNpmSource ? '-npm' : '') + (apiKey ? '-trial' : '') + '.js';
            utils.writeToFile(packageJsonLocation, JSON.stringify(ionicPackage, null, 4));

            ncp(__dirname + '/../resources/ionic/scripts', currDir + '/scripts', function (err) {
                if (err) {
                    utils.printError('Could not copy mobiscroll resources.\n\n' + err);
                    return;
                }
            });

            // Load css in the index.html
            fs.readFile(currDir + '/src/index.html', 'utf8', function (err, data) {
                if (err) {
                    utils.printError('Could not read index.html \n\n' + err);
                    return;
                }

                if (data.indexOf(cssFileName) == -1) {
                    data = data.replace(/<link ([^>]+) rel="stylesheet">/, function (match) {
                        return '<link rel="stylesheet" href="' + cssFileName + '">\n  ' + match;
                    });

                    utils.writeToFile(currDir + '/src/index.html', data);
                }
            });

            // Modify app.module.ts add necesarry modules
            fs.readFile(currDir + '/src/app/app.module.ts', 'utf8', function (err, data) {
                if (err) {
                    utils.printError('There was an error during reading app.module.ts. \n\nHere is the error message:\n\n' + err);
                    return;
                }

                // Remove previous module load
                data = data.replace(/import \{ MbscModule(?:, mobiscroll)? \} from '[^']*';\s*/, '');
                data = data.replace(/[ \t]*MbscModule,[ \t\r]*\n/, '');

                // Add angular module imports which are needed for mobscroll
                data = utils.addAngularModuleImport('MbscModule', jsFileName, data, apiKey);
                data = utils.addAngularModuleImport('FormsModule', '@angular/forms', data);

                // Remove previous api key if present
                data = data.replace(/mobiscroll.apiKey = ['"][a-z0-9]{8}['"];\n\n?/, '');

                // Inject api key if trial
                if (apiKey) {
                    data = data.replace('@NgModule', 'mobiscroll.apiKey = \'' + apiKey + '\';\n\n@NgModule');
                }

                utils.writeToFile(currDir + '/src/app/app.module.ts', data);
            });

            utils.printFeedback('Mobiscroll config ionic finished!');
        }
    }
}