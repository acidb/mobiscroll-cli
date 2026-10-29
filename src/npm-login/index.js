var ncl = require('./login.js');

module.exports = function (user, pass, email, registry, scope, quotes, configPath, proxyUrl) {
    var finalArgs = ncl.processArguments(user, pass, email, registry, scope, quotes, configPath, proxyUrl);
    var response;
    var contents;
    var newContents;

    return new Promise(function (resolve, reject) {
        ncl.login(finalArgs, function (err, data) {
            if (err) {
                reject(err);
            } else {
                response = data;
                ncl.readFile(finalArgs, function (err, data) {
                    if (err) {
                        reject(err);
                    } else {
                        contents = data;
                        newContents = ncl.generateFileContents(finalArgs, contents, response);
                        ncl.writeFile(finalArgs, newContents);
                        resolve();
                    }
                });
            }
        });
    });
};

// Writes a token obtained elsewhere (browser sign-in) the same way a password login does
module.exports.saveToken = function (token, registry, scope, configPath) {
    var finalArgs = ncl.processArguments(null, null, null, registry, scope, null, configPath);
    ncl.readFile(finalArgs, function (err, contents) {
        ncl.writeFile(finalArgs, ncl.generateFileContents(finalArgs, contents, { token: token }));
    });
};