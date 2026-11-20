const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

// Reads the Mobiscroll npm token the package manager would use, without ever printing it.
// npm 9+ refuses to print auth values (npm config get), so the config files are read directly,
// in npm's order: the project's .npmrc, then the user-level one, then Yarn 2+'s .yarnrc.yml.

// Expands ${VAR} and Yarn's ${VAR-default} / ${VAR:-default} forms from the environment.
function expandEnv(value) {
  return value.replace(/\$\{([A-Za-z0-9_]+)(:?-[^}]*)?\}/g, (match, name, fallback) => {
    if (process.env[name]) {
      return process.env[name];
    }
    return fallback ? fallback.replace(/^:?-/, '') : '';
  });
}

function unquote(value) {
  return value.replace(/^["'](.*)["']$/, '$1');
}

function registryHost(registryUrl) {
  return registryUrl.replace(/^https?:/, '').replace(/\/$/, '');
}

// noExpand: return the value as written, so a ${VAR} reference can be told apart from a real token
function tokenFromNpmrc(filePath, registryUrl, noExpand) {
  if (!filePath || !fs.existsSync(filePath)) {
    return '';
  }
  const host = registryHost(registryUrl).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = fs.readFileSync(filePath, 'utf8').match(new RegExp('^\\s*' + host + '/?:_authToken\\s*=\\s*(.+?)\\s*$', 'im'));
  if (!match) {
    return '';
  }
  return noExpand ? unquote(match[1]) : expandEnv(unquote(match[1]));
}

function tokenFromYarnrc(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return '';
  }
  try {
    const data = yaml.load(fs.readFileSync(filePath, 'utf8'));
    const scope = data && data.npmScopes && data.npmScopes.mobiscroll;
    return scope && scope.npmAuthToken ? expandEnv(String(scope.npmAuthToken)) : '';
  } catch (err) {
    return '';
  }
}

/**
 * Returns the npm token for the registry, or '' if none is set.
 * @param {{ currDir: string, monorepoRoot: string|null, registryUrl: string }} options
 */
function readNpmToken(options) {
  const dirs = [options.currDir];
  if (options.monorepoRoot && options.monorepoRoot !== options.currDir) {
    dirs.push(options.monorepoRoot);
  }
  const userNpmrc = process.env.NPM_CONFIG_USERCONFIG || path.join(os.homedir(), '.npmrc');

  const candidates = dirs
    .map((dir) => () => tokenFromNpmrc(path.resolve(dir, '.npmrc'), options.registryUrl))
    .concat(() => tokenFromNpmrc(userNpmrc, options.registryUrl))
    .concat(dirs.map((dir) => () => tokenFromYarnrc(path.resolve(dir, '.yarnrc.yml'))))
    .concat(() => tokenFromYarnrc(path.join(os.homedir(), '.yarnrc.yml')));

  for (let i = 0; i < candidates.length; i++) {
    const token = candidates[i]();
    if (token) {
      return token;
    }
  }
  return '';
}

module.exports = {
  readNpmToken,
  tokenFromNpmrc,
  expandEnv,
};
