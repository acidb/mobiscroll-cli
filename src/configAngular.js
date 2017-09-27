const utils = require('./utils.js');
const fs = require('fs');
const ncp = require('ncp').ncp;

module.exports = {
    configAngular: function (packageJson, packageJsonLocation, currDir, jsFileName, cssFileName) {

        // modify app.module.ts with 
        fs.readFile(currDir + '\\src\\app\\app.module.ts', 'utf8', function (err, data) {
            if (err) {
                utils.printError('There was an error during reading app.module.ts. \n\nHere is the error message:\n\n' + err);
                return;
            }

            // add angular module imports which are needed for mobscroll
            data = utils.addAngularModuleImport('MbscModule', '../lib/mobiscroll/js/' + jsFileName + '.js', data);
            data = utils.addAngularModuleImport('FormsModule', '@angular/forms', data);

            utils.writeToFile(currDir + '\\src\\app\\app.module.ts', data);
        });

        // modify .angular-cli.json with 
        fs.readFile(currDir + '\\.angular-cli.json', 'utf8', function (err, data) {
            if (err) {
                utils.printError('There was an error during reading app.module.ts. \n\nHere is the error message:\n\n' + err);
                return;
            }

            // add angular module imports which are needed for mobscroll
            data = data.replace('"styles": ["', '"styles": [\n        "./node_modules/@mobiscroll/angular/dist/css/*",');

            utils.writeToFile(currDir + '\\.angular-cli.json', data);
        });
    }
}