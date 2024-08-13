const chalk = require('chalk');
const terminalLink = require('terminal-link');
const semver = require('semver');

module.exports = {
  angularLazy: (isTrial, isLite, isStandalone, isWarning) => {
    const standaloneCode = `
    @Component({
        standalone: true,
        // add the mobiscroll and form modules
        imports: [ MbscModule, FormsModule, /* leave the other imports as they are */],
        // ...
    `;

    console.log(
      `\n ${isWarning ? '1. M' : 'You can m'}anually include the ${chalk.grey('MbscModule')} and ${chalk.grey('FormsModule')} to your ${isStandalone ? 'component' : chalk.grey('*.module.ts') + ' file'
      } the following way:\n`
    );
    console.log("    import { MbscModule } from '@mobiscroll/angular" + (isLite ? '-lite' : '') + "';");
    console.log("    import { FormsModule } from '@angular/forms';\n");

    if (isStandalone) {
      console.log(standaloneCode);
    } else {
      console.log('    @NgModule({');
      console.log('        imports: [');
      console.log('            // leave the other imports as they are');
      console.log('            // ... ');
      console.log('            MbscModule, // add the mobiscroll module');
      console.log('            FormsModule // add the forms module');
      console.log('        ],');
      console.log('        declarations: // ...\n');

      if (isWarning) {
        console.log(
          `\n  If you are using standalone components, include it in the component file the following way:\n`
        );
      }
      console.log(standaloneCode);
    }
  },
  configHelp: () => {
    console.log('\n\n  Installs Mobiscroll resources from npm and includes the necessary dependencies.');
    console.log('\n  Types:\n');
    console.log('    angular         Use it for configuring Angular 2+ applications.\n');
    console.log('    ionic           Use it for configuring Ionic 2+ applications.\n');
    console.log('    javascript      Use it for configuring JavaScript applications. Use it with frameworks like: Knockout, Ember.js...\n');
    console.log('    jquery          Use it for configuring jQuery based applications.\n');
    console.log('    react           Use it for configuring React applications.\n');
    console.log('    vue             Use it for configuring Vue applications.\n');
  },
  startHelp: () => {
    console.log('\n\n  Clones the repository containing demos from the Mobiscroll website and installs the necessary dependencies.');
    console.log('\n  Types:\n');
    console.log('    angular         Installs the Angular demo project.)\n');
    console.log('    react           Installs the React demo project.)\n');
    console.log('    react-ts        Installs the React typescript demo project.)\n');
    console.log('    vue             Installs the Vue demo project.)\n');
    console.log('    vue-ts          Installs the Vue typescript demo project.)\n');
    console.log('    javascript      Installs the plain JavaScript demo project.)\n');
    console.log('    jquery          Installs the jQuery demo project.)\n');
  },
  jsHelp: (framework) => {
    console.log(`\nFind more information about the usage on the ` + terminalLink('documentation page:', `https://mobiscroll.com/docs/${framework}`));
    console.log(`\nFind usage examples on the ` + terminalLink('demo page:', `https://demo.mobiscroll.com/${framework}/eventcalendar/`) + '\n');
  },
  vueHelp: (npmSource, useScss, version) => {
    console.log(
      `

import { MbscEventcalendar } from '@mobiscroll/vue'; /* or import any other component */
import '` +
      `@mobiscroll/vue/dist/css/mobiscroll.${npmSource ? '' : 'vue.'}${useScss ? 'scss' : 'min.css'}';
        `
    );

    console.log(`\nFind more information about the usage on the ` + terminalLink('documentation page:', 'https://mobiscroll.com/docs/vue'));
    console.log(`\nFind usage examples on the ` + terminalLink('demo page:', 'https://demo.mobiscroll.com/vue/eventcalendar/') + '\n');
  },
  reactHelp: (isTrial, isLite, npmSource, useScss, version) => {
    if (semver.gte(version, '5.0.0-beta')) {
      console.log(
        `
import { Eventcalendar } from '@mobiscroll/react'; /* or import any other component */
import '` +
        `@mobiscroll/react${isLite ? '-lite' : ''}/dist/css/mobiscroll.${npmSource ? '' : 'react.'}${useScss ? 'scss' : 'min.css'}';
            `
      );

      console.log(
        `\nFind more information about the usage on the ` + terminalLink('documentation page:', 'https://mobiscroll.com/docs/react')
      );
      console.log(`\nFind usage examples on the ` + terminalLink('demo page:', 'https://demo.mobiscroll.com/react/eventcalendar/') + '\n');
    } else {
      console.log(
        `
You can import Mobiscroll to your react component like:

import mobiscroll from ` +
        `'@mobiscroll/react` +
        (isLite ? '-lite' : '') +
        `';
import '` +
        `@mobiscroll/react${isLite ? '-lite' : ''}/dist/css/mobiscroll.${npmSource ? '' : 'react.'}${useScss ? 'scss' : 'min.css'}';
        `
      );
    }
  },
  startNextSteps: (folderName, runCommand) => {
    console.log('\nNEXT STEPS');
    console.log(`
  - Go to your newly created project: ${chalk.bold.cyan('cd .\\' + folderName)} 
  - Run the app with the following command: ${chalk.bold.cyan(runCommand)}
        `);
  },
};
