#!/usr/bin/env node

const path = require('path')
const fs = require('fs');
const sass = require('node-sass')

const {makeAdjustableVar, sassToString, maybeCalc, maybeCalcP, ensureDirectoryExistence, rgbToHsl, renderSassSync, writeOutput, maybeVar} = require("./utils");

const args = process.argv.slice(2);

if (args.length < 2) {
  console.error("Usage:" + process.argv[0] + process.argv[1] + " ouput.css input.sass [...[theme-name:]theme-file.sass | any]")
  console.log("Passing 'any' as a third argument will generate a file with all of the css variables")
  console.log("If passing a list of theme they will all be bundled in the same file but it will be optimized to only use the modified variables")
}

const argThemes = args.slice(2);

const input = args[1];

const outInfo = path.parse(args[0])

const output = path.resolve(process.cwd(), outInfo.dir + path.sep + outInfo.name);

//List of found vars and their value
const vars = {}

ensureDirectoryExistence(output)


if (argThemes.length === 0) {
  //No variables build
  const non_themeable = renderSassSync(input, "", {
    '_v($name)': function (name) {
      try {
        vars[name.getValue()] = true;
      } catch (e) {
        console.log(name)
      }

      return name;
    },
  });
  //Output the non themeable generated css
  writeOutput(output, non_themeable.css, non_themeable.map, input)
} else {
  const defaultVars = '(' + Object.keys(vars).map((v) => '"' + v + '":' + vars[v]).join(', ') + ')';
  if (argThemes.length === 1 && argThemes[0] === 'any') {

    //Insert all the found vars into a sass list and inject it for compilation
    let data = '$themeable: "any";'
    const render = renderSassSync(input, data, {
      '_v($name, $value)': function (name, value) {
        return new sass.types.String(maybeVar(name.getValue()));
      },
    });

    //Output the themeable generated css
    writeOutput(output, render.css, render.map, input)
  } else {
    const promises = [];

    const themes = {};
    const themesVars = {};

    argThemes.forEach((theme) => {
      let name = "";
      let file = theme;
      if (theme.indexOf(':') > 0) {
        [name, file] = theme.split(':', 2)
      } else {
        name = path.parse(theme).name
      }
      if (!name) {
        console.error('A theme must have a unique name')
        return;
      }
      themes[name] = file;

      let data = '@import "' + file + '"'

      const themeVars = themesVars[name] = {}

      //Make all renders of theme async to speed things up
      //They are just run blank to get all the variables of each theme
      promises.push(new Promise((resolve) => {
        sass.render({
          data,
          includePaths: [path.resolve(process.cwd(), file)],
          functions: {
            '_v($name, $value)': function (name, value) {
              themeVars[name.getValue()] = sassToString(value);
              return value;
            },
          }
        }, resolve)
      }));

    })

    if (Object.keys(themes).length === 0) {
      console.error("No theme to process, exiting")
      return;
    }

    //When all renders are done
    Promise.all(promises).then(() => {
      const modified = [];
      Object.keys(vars).forEach((varName) => {
        let val = vars[varName];
        for (let themeName in themes) {
          if (val !== themesVars[themeName][varName]) {
            modified.push(varName);
            break;
          }
        }
      })

      data = '$themeable: true;\n' +
        '$css_vars: (default: ' + defaultVars + ',' + Object.keys(themes).map((theme) => '"' + theme + '":(' + modified.map((v) => '"' + v + '":' + themesVars[theme][v]).join(', ') + ')') + ');'
      const render = renderSassSync(input, data, {
        '_v($name, $value)': function (name, value) {
          if (modified.indexOf(name.getValue()) >= 0) {
            return new sass.types.String(maybeVar(name.getValue()));
          }
          return value
        },
        '_vAdjustHSLA($name, $value, $h, $s, $l, $a)': function (name, value, h, s, l, a) {
          let str = "hsla(";

          const [oH, oS, oL] = rgbToHsl(value.getR(), value.getG(), value.getB());

          name = name.getValue();
          h.setUnit('')
          s.setUnit('%')
          l.setUnit('%')
          str += maybeCalc(name + "-h", h, false, modified, oH) + ','
          str += maybeCalc(name + "-s", s, false, modified, oS) + ','
          str += maybeCalc(name + "-l", l, false, modified, oL) + ','
          str += maybeCalc(name + "-a", a, true, modified, value.getA())

          return sass.types.String(str + ')')
        },
      })

      writeOutput(output, render.css, render.map, input)
    })
  }

}
