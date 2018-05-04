const fs = require('fs');
const chalk = require('chalk');
const exec = require('child_process').exec;
const request = require('request');
const mbscNpmUrl = 'https://npm.mobiscroll.com';

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

function runCommand(cmd, skipWarning, skipError, skipLog) {
    if (!skipLog) {
        console.log(`${chalk.green('>')} ${cmd}`);
    }
    return new Promise((resolve, reject) => {
        exec(cmd, function (error, stdout, stderr) {
            if (stderr && !skipError && !skipWarning) {
                printWarning('There was an stderror during executing the following command ' + chalk.gray(cmd) + '. \n\nHere is the warning message: \n\n' + stderr);
            }
            if (error && !skipError) {
                //printError('Could not run command ' + chalk.gray(cmd) + '. \n\n' + error);
                reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
}

function writeToFile(location, data, callback) {
    fs.writeFile(location, data, function (err) {
        if (err) {
            printError('Could not write to file ' + chalk.gray(location) + '. \n\n' + err);
        }
        if (callback) {
            callback();
        }
    });
}

function importModule(moduleName, location, data) {
    if (data.indexOf(moduleName) == -1) { // check if module is not loaded
        data = "import { " + moduleName + " } from '" + location + "';\n" + data;
        data = data.replace('imports: [', 'imports: [ \n' + '    ' + moduleName + ',');
    }
    return data;
}

function getMobiscrollVersion(callback) {
    request('http://api.mobiscroll.com/api/getmobiscrollversion', function (error, response, body) {
        if (error) {
            printError('Could not get mobiscroll version.' + error);
        }

        if (!error && response.statusCode === 200) {
            body = JSON.parse(body);
            callback(body.Version);
        }
    });
}

module.exports = {
    run: runCommand,
    writeToFile: writeToFile,
    getMobiscrollVersion: getMobiscrollVersion,
    checkTypescriptVersion: (version) => {
        var v = version.split('.').map((x) => {
            return +x.replace(/[^\d]/, '')
        });

        if (v[0] < 2 || v[0] == 2 && v[1] < 2) {
            printWarning(`Your app's TypeScript version is older then the minimum required version for Mobiscroll. (${version} < 2.2.0) Please update your project's Typescript version. (You can update the following way: $ npm install typescript@latest)`)
            return false;
        }

        return true;
    },
    installMobiscrollLite: function (framework, callback) {
        framework = (framework.indexOf('ionic') > -1 ? 'angular' : framework);
        runCommand(`npm install @mobiscroll/${framework}-lite@latest --save`, true).then(() => {
            printFeedback(`The lite version of Mobiscroll for ${framework} installed.`);
            callback();
        });
    },
    removeUnusedaPackages: function (framework, packageJsonLocaltion, isTrial, isLite, callback, noNpm) {
        framework = (framework.indexOf('ionic') > -1 ? 'angular' : framework);

        var changed,
            packageName = `@mobiscroll/${framework}`,
            trialPackageName = packageName + '-trial',
            litePackageName = `@mobiscroll/${framework}-lite`,
            packageJson = JSON.parse(fs.readFileSync(packageJsonLocaltion, 'utf8'));

        if (noNpm) {
            // delete the mobiscroll references if it was installed from a local file system
            delete packageJson.dependencies[trialPackageName];
            delete packageJson.dependencies[packageName];
            delete packageJson.dependencies[litePackageName];
            changed = true;
        } else {
            if (!isTrial && packageJson.dependencies[trialPackageName]) {
                changed = true;
                // Remove mobiscroll-trial package form package.json if the licenced version is installed
                delete packageJson.dependencies[trialPackageName];
            } else if (isTrial && packageJson.dependencies[packageName]) {
                changed = true;
                // Remove mobiscroll package form package.json if the trial version is installed
                delete packageJson.dependencies[packageName];
            }

            if (!isLite && packageJson.dependencies[litePackageName]) {
                changed = true;
                // delete lite package
                delete packageJson.dependencies[litePackageName];
            }
        }

        if (changed) {
            writeToFile(packageJsonLocaltion, JSON.stringify(packageJson, null, 4), callback);
        } else {
            callback();
        }
    },
    installMobiscroll: function (framework, currDir, userName, isTrial, callback) {
        var frameworkName = (framework.indexOf('ionic') > -1 ? 'angular' : framework),
            pkgName = frameworkName + (isTrial ? '-trial' : ''),
            command;

        getMobiscrollVersion(function (version) {
            if (isTrial) {
                command = `npm install ${mbscNpmUrl}/@mobiscroll/${pkgName}/-/${pkgName}-${version}.tgz --save --registry=${mbscNpmUrl}`;
            } else {
                command = `npm install @mobiscroll/${pkgName}@latest --save`;
            }

            // Skip node warnings
            printFeedback(`Installing packages via npm...`);
            runCommand(command, true).then(() => {
                printFeedback(`Mobiscroll for ${framework} installed.`);
                callback();
            }).catch((reason) => {
                if (/403 Forbidden/.test(reason)) {
                    reason = `User ${userName} has no access to package @mobiscroll/${pkgName}.`;
                }
                printError('Could not install Mobiscroll.\n\n' + reason);
            });
        })
    },
    packMobiscroll: (packLocation, currDir, framework, callback) => {
        process.chdir(packLocation); // change directory to node modules folder

        console.log(`\n${chalk.green('>')} changed current directory to ${packLocation}. \n`);

        runCommand('npm pack').then(() => { // run npm pack which will generate the mobiscroll package
            fs.readdir(packLocation, function (err, files) {
                if (err) {
                    printError('Could not access to the directory filse.\n\n' + err);
                    return;
                }

                let mbscPackage = files.filter((f) => {
                    // return the full name of the generated package
                    return f.includes(`mobiscroll-${framework}`);
                });

                if (mbscPackage.length) {
                    // set the current durectory back to the default
                    process.chdir(currDir);
                    //console.log(`\n${chalk.green('>')} Changed back current directory to the default one. \n`);

                    callback(mbscPackage[0]);
                }
            })

        });
    },
    importModules: function (currDir, jsFileName) {
        console.log(`  Adding module loading scripts to ${chalk.grey('src/app/app.module.ts')}`);
        // Modify app.module.ts add necesarry modules
        fs.readFile(currDir + '/src/app/app.module.ts', 'utf8', function (err, data) {
            if (err) {
                printError('There was an error during reading app.module.ts. \n\nHere is the error message:\n\n' + err);
                return;
            }

            // Remove previous module load
            data = data.replace(/import \{ MbscModule(?:, mobiscroll)? \} from '[^']*';\s*/, '');
            data = data.replace(/[ \t]*MbscModule,[ \t\r]*\n/, '');

            // Add angular module imports which are needed for mobscroll
            data = importModule('MbscModule', jsFileName, data);
            data = importModule('FormsModule', '@angular/forms', data);

            // Remove previous api key if present
            data = data.replace(/mobiscroll.apiKey = ['"][a-z0-9]{8}['"];\n\n?/, '');

            writeToFile(currDir + '/src/app/app.module.ts', data);
        });
    },
    printFeedback: printFeedback,
    printWarning: printWarning,
    printError: printError,
    npmUrl: mbscNpmUrl
};