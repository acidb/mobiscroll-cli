const fs = require('fs');
const chalk = require('chalk');
const exec = require('child_process').exec;

function printWarning(text) {
    console.log('\n' + chalk.bold.yellow(text));
}

function printError(text) {
    console.log('\n' + chalk.bold.red(text) + chalk.magenta('\n\nIf the problem persists, please contact us at support@mobiscroll.com'));
    process.exit();
}

function printFeedback(text) {
    console.log('\n' + chalk.bold.cyan(text));
}

function runCommand(cmd, skipWarning, skipError) {
    return new Promise((resolve, reject) => {
        exec(cmd, function (error, stdout, stderr) {
            if (stderr && !skipError && !skipWarning) {
                printWarning('There was an stderror during executing the following command ' + chalk.gray(cmd) + '. \n\nHere is the warning message: \n\n' + stderr);
            }
            if (error && !skipError) {
                printError('Could not run command ' + chalk.gray(cmd) + '. \n\n' + error);
                reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
}

module.exports = {
    run: runCommand,
    installMobiscroll: function (framework, packageJsonLocation, isTrial, callback) {
        // Skip node warnings
        runCommand('npm install @mobiscroll/' + framework + (isTrial ? '-trial' : '') + ' --save', true).then(() => {
            printFeedback('Mobiscroll ' + framework + ' installed.');
            callback();
        }).catch((reason) => {
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
            data = "import { " + moduleName + (mobiscrollGlobal ? ", mobiscroll" : '') + " } from '" + location + "';\n" + data;
            data = data.replace('imports: [', 'imports: [ \n' + '    ' + moduleName + ',');
        }

        return data;
    },
    printFeedback: printFeedback,
    printWarning: printWarning,
    printError: printError
}