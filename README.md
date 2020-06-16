Mobiscroll CLI
==============

Installation
------------

    npm install -g @mobiscroll/cli

Usage
-----

    For detailed usage information please run the `mobiscroll --help` command or visit the [CLI docs page](https://docs.mobiscroll.com/cli).


Dev usage
---------

  - run `npm install` in the root folder for installing dependencies 
  
  - For trying out the cli locally run the `npm install -g` command in the root folder. This command will install the package globally on your system. (You might need to uninstall the previous version if there are intallation conflicts between npm and local variants. Use: `npm uninstall -g @mobiscroll/cli`)
  
Publishing
----------

  - write new changelog in the `changelog.txt` also move this to the website as well
  
  - make sure to change the version number in the `package.json` file
  
  - log in with the mobiscroll npm user
  
  - run `npm publish` for publishing the new version