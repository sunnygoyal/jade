# JAvascript based Database Editor
*A web based GUI client for SQLite.*
Get it on Crome Web Store or try online.

----------

## Development

**Web UI**
To see the code in action, just start a local server and point it the code directory.

**Chrome Plugin**

 1. go to [chrome://extensions/](chrome://extensions/) in chrome
 2. enable developer mode
 3. select `load unpacked extension...` and select the project directory

### Publishing
To generate a compressed code run

```
make web_ui
make extension
```

### Dependencies
Jade depends on the following external projects

 - [sql.js](https://github.com/kripken/sql.js/)
 - [Material design icons](https://github.com/google/material-design-icons)
 - [Materialize CSS](https://github.com/Dogfalo/materialize)
 - [JQuery](https://github.com/jquery/jquery)
 - [Velocity](https://github.com/julianshapiro/velocity)
 - [CodeMirror](https://github.com/codemirror/codemirror)

> **Note** The project uses a modified version of [sql.js](https://github.com/sunnygoyal/sql.js), which has a few changes requred by this project. Refer the commit history of [sql.js](https://github.com/sunnygoyal/sql.js) for additional information.

All the third party dependencies are included in the `third_party/` directory.
To regenerate the `third_party/` directory run

```
bower update
rm -rf third_party
make third_party_deps
```

### Tools
You will need the following tools to run the above make commands.

 - [sass](https://github.com/sass/sass)
 - [pegjs](https://github.com/pegjs/pegjs)
 - [cssmin](https://github.com/jbleuzen/node-cssmin)
 