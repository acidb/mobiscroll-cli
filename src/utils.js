const fs = require('fs');
const chalk = require('chalk');
const exec = require('child_process').exec;

function printWarning(text) {
    console.log('\n' + chalk.bold.yellow(text));
};

function printError(text) {
    console.log('\n' + chalk.bold.red(text) + chalk.magenta('\n\nIf the problem persists, please contact us at support@mobiscroll.com'));
    process.exit();
}

function printFeedback(text) {
    console.log('\n' + chalk.bold.cyan(text));
}

function runCommand(cmd) {
    var skipError = cmd.indexOf('npm whoami') != -1, // if `npm whoami` command passed
        skipWarning = cmd.indexOf('npm install @mobiscroll') != -1; // if there are node warnings after installation

    return new Promise((resolve, reject) => {
        exec(cmd, function (error, stdout, stderr) {
            if (stderr !== null && !skipError && !skipWarning) {
                printWarning('There was an stderror during executing the following command ' + chalk.gray(cmd) + '. \n\nHere is the warning message: \n\n' + stderr);
            }
            if (error !== null && !skipError) {
                printError('Could not run command ' + chalk.gray(cmd) + '. \n\n' + error);
                reject(error);
            }
            resolve(stdout);
        });
    });
}

module.exports = {
    run: runCommand,
    installMobiscroll: function (framework, isTrial, callback) {
        isTrial = false;
        runCommand('npm install @mobiscroll/' + framework + (isTrial ? '-trial' : '') + ' --save')
            .then(() => {
                printFeedback('Mobiscroll ' + framework +  ' installed.');
                callback();
            })
            .catch((reason) => {
                printError('Could not install Mobiscroll.\n\n' + reason)
            });
    },
    writeToFile: function (location, data) {
        fs.writeFile(location, data, function (err) {
            if (err) {
                printError('Could not write to file ' + chalk.gray(location) + '. \n\n' + err);
            }
        });
    },
    addAngularModuleImport: function (moduleName, location, data, mobiscrollGlobal) {
        if (data.indexOf(moduleName) == -1) { // check if module is not loaded
            data = "import { " + moduleName + (mobiscrollGlobal ? ", mobiscroll" : '') + " } from '" + location + "'; \r\n" + data;
            data = data.replace('imports: [', 'imports: [ \r\n' + '    ' + moduleName + ',');
        }

        return data;
    },
    printFeedback: printFeedback,
    printWarning: printWarning,
    printError: printError
}