var npmAddUser = require('./adduser');
var fs = require('fs');
var path = require('path');

// jshint freeze:false
if (!Array.prototype.findIndex) {
    Array.prototype.findIndex = function (predicate) {
        if (this === null) {
            throw new TypeError('Array.prototype.findIndex called on null or undefined');
        }
        if (typeof predicate !== 'function') {
            throw new TypeError('predicate must be a function');
        }
        var list = Object(this);
        var length = list.length >>> 0;
        var thisArg = arguments[1];
        var value;

        for (var i = 0; i < length; i++) {
            value = list[i];
            if (predicate.call(thisArg, value, i, list)) {
                return i;
            }
        }
        return -1;
    };
}
// jshint freeze:true

module.exports = {
    processArguments: function (npmUser, npmPass, npmEmail, npmRegistry, npmScope, quotes, configPath, proxySettings) {
        var registry = npmRegistry || 'https://registry.npmjs.org';
        var homePath = process.env.HOME ? process.env.HOME : process.env.USERPROFILE;
        var finalPath = configPath ? configPath : path.join(homePath, '.npmrc');
        var hasQuotes = quotes ? quotes : false;
        var args = {
            user: npmUser,
            pass: npmPass,
            email: npmEmail,
            registry: registry,
            scope: npmScope,
            quotes: hasQuotes,
            configPath: finalPath,
            proxy: proxySettings
        };

        return args;
    },

    login: function (args, callback) {
        npmAddUser(args.registry, {
            username: args.user,
            password: args.pass,
            email: args.email
        },
        args.proxy ||  undefined,
         function (err, data) {
            if (err) {
                return callback(err);
            }
            return callback(null, data);
        });
    },

    readFile: function (args, callback) {
        var contents = '';

        try {
            contents = fs.readFileSync(args.configPath, 'utf-8');
        } catch (err) {
            //console.log('Error in utils readFile: ' + err );
        }

        return callback(null, contents);
    },

    generateFileContents: function (args, contents, response) {
        // `contents` holds the initial content of the NPMRC file
        // Convert the file contents into an array
        var lines = contents ? contents.split('\n') : [];

        if (args.scope !== undefined) {
            var scopeWrite = lines.findIndex(function (element) {
                if (element.indexOf(args.scope + ':registry=' + args.registry) !== -1) {
                    // If an entry for the scope is found, replace it
                    element = args.scope + ':registry=' + args.registry;
                    return true;
                }
            });

            // If no entry for the scope is found, add one
            if (scopeWrite === -1) {
                lines.push(args.scope + ':registry=' + args.registry);
            }
        }

        var authWrite = lines.findIndex(function (element, index, array) {
            if (element.indexOf(args.registry.slice(args.registry.search(/\:\/\//, '') + 1) +
                    '/:_authToken=') !== -1) {
                // If an entry for the auth token is found, replace it
                array[index] = element.replace(/authToken\=.*/, 'authToken=' + (args.quotes ? '"' : '') +
                    response.token + (args.quotes ? '"' : ''));
                return true;
            }
        });

        // If no entry for the auth token is found, add one
        if (authWrite === -1) {
            lines.push(args.registry.slice(args.registry.search(/\:\/\//, '') +
                1) + '/:_authToken=' + (args.quotes ? '"' : '') + response.token + (args.quotes ? '"' : ''));
        }

        var toWrite = lines.filter(function (element) {
            if (element === '') {
                return false;
            }
            return true;
        });

        return toWrite;
    },

    writeFile: function (args, lines) {
        fs.writeFileSync(args.configPath, lines.join('\n') + '\n');
    }
};