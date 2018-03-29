module.exports = {
    ionicLazy: (isTrial, isLite) => {
        console.log(`\nIf you are using ionic lazy loading you'll have to manually include the MbscModule and FormsModule into the page's module.ts file where you'll be using Mobiscroll.\n\nExample:\n`);
        console.log("    import { MbscModule } from '@mobiscroll/angular" + (isLite ? '-lite' : '') + "';");
        console.log("    import { FormsModule } from '@angular/forms';\n");
        console.log("    @NgModule({");
        console.log("        imports: [");
        console.log("            // leave the other imports as they are");
        console.log("            // ... ");
        console.log("            MbscModule, // add the mobiscroll module");
        console.log("            FormsModule // add the forms module");
        console.log("        ],");
        console.log("        declarations: // ...");
    },
    configHelp: () => {
        console.log('\n  Types:\n');
        console.log('    angular         Use it for configuring Angular 2+ applications.\n');
        console.log('    angularjs       Use it for configuring Angularjs(1.x) applications.\n');
        console.log('    ionic           Use it for configuring Ionic 2+ applications.\n');
        console.log('    ionic-pro       Use it for configuring Ionic 2+ applications. Use this command if you are using Ionic pro. \n');
        console.log('    javascript      Use it for configuring JavaScript applications. Use it with frameworks like: Vue, Knockout, Ember.js...\n');
        console.log('    jquery          Use it for configuring jQuery based applications.\n');
        console.log('    react           Use it for configuring React applications.\n');
    },
    vueHelp: (framework, isTrial, isLite) => {
        console.log(`
A vue.js application detected. Here is how to import Mobiscroll into your app:

import mobiscroll from ` + `'@mobiscroll/${framework}` + (isLite ? '-lite' : '') + `';
import '` + `@mobiscroll/${framework}` + (isLite ? '-lite' : '') + `/dist/css/mobiscroll.min.css';
        `);
    },
    reactHelp: (isTrial, isLite) => {
        console.log(`
You can import Mobiscroll to your react component like:

import mobiscroll from ` + `'@mobiscroll/react` + (isLite ? '-lite' : '') + `';
import '` + `@mobiscroll/react` + (isLite ? '-lite' : '') + `/dist/css/mobiscroll.min.css';
        `);

    }
};