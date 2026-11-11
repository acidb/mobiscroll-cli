// The --help screens. Commander 2 can't print an Examples section or "Usage: mobiscroll <command>", so each
// command's helpInformation() is replaced with these. The option rows come from the options registered on the
// command (flags + description), so a new option shows up in the help without touching this file.
// Only builds strings: no output, no side effects.

const docsUrl = 'https://mobiscroll.com/docs/react/core-concepts/cli';
// The commands are registered with optional arguments ([types]) so a missing one gets a friendly message;
// the help shows what they need
const usages = { config: 'config <type>', start: 'start <type> <name>' };
const agentExample ='# AI agents: show the printed link and code, then rerun';

function rows(list) {
  const width = Math.max(...list.map((r) => r[0].length)) + 3;
  return list.map((r) => '  ' + r[0].padEnd(width) + r[1]).join('\n');
}

function optionRows(cmd, globals) {
  // the descriptions are kept as they were; some end with a newline, which would break the columns
  const list = cmd.options.map((o) => [o.flags, o.description.trim()]);
  if (globals) {
    list.push([globals, 'See mobiscroll --help']);
  }
  list.push(['-h, --help', 'output usage information']);
  return rows(list);
}

function section(title, body) {
  return `${title}:\n${body}\n`;
}

function examples(list) {
  return section('Examples', list.map((e) => '  ' + e).join('\n'));
}

module.exports = {
  main: (program) =>
    [
      'Usage: mobiscroll <command> [options]\n',
      section(
        'Commands',
        rows(program.commands.map((c) => [usages[c._name] || c._name, c._description.trim()])),
      ),
      section('Options', optionRows(program)),
      examples(['mobiscroll config react', `mobiscroll config react --yes --no-wait   ${agentExample}`]),
      'Run mobiscroll <command> --help for its options.',
      `Learn more: ${docsUrl}\n`,
    ].join('\n'),

  config: (cmd) =>
    [
      'Usage: mobiscroll config <type> [options]\n',
      cmd._description.trim(),
      'Types: angular, ionic, javascript, jquery, react, vue\n',
      section('Options', optionRows(cmd, '-g, -y')),
      examples(['mobiscroll config angular --scss', `mobiscroll config react --yes --no-wait   ${agentExample}`]),
    ].join('\n'),

  login: (cmd) =>
    [
      'Usage: mobiscroll login [options]\n',
      cmd._description.trim() + '\n',
      section('Options', optionRows(cmd, '-g, -y')),
      examples(['mobiscroll login', `mobiscroll login --yes --no-wait   ${agentExample}`]),
    ].join('\n'),

  logout: (cmd) =>
    ['Usage: mobiscroll logout [options]\n', cmd._description.trim() + '\n', section('Options', optionRows(cmd, '-g'))].join('\n'),

  start: (cmd) =>
    [
      'Usage: mobiscroll start <type> <name> [options]\n',
      cmd._description.trim(),
      'Types: angular, react, react-ts, vue, vue-ts, javascript, jquery\n',
      section('Options', optionRows(cmd, '-g, -y')),
      examples([
        'mobiscroll start react my-app',
        '# AI agents: sign in first (show the printed link and code, then rerun), then start',
        'mobiscroll login -g --yes --no-wait',
        'mobiscroll start react my-app --yes',
      ]),
    ].join('\n'),
};
