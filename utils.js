const sass = require('node-sass')
const path = require('path')
const fs = require('fs')

const ensureDirectoryExistence = (filePath) => {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  fs.mkdirSync(dirname, {recursive: true});
}


/**
 * Converts sass types to plain strings that can be read again by the sass compiler
 * @param value
 * @returns {string}
 */
const sassToString = (value) => {
  let val = "";
  if (value instanceof sass.types.Color) {
    const a = parseInt(value.getA() * 255);
    if (a === 0) {
      val = 'transparent'
    } else {
      val = '#' + parseInt(value.getR()).toString(16).padStart(2, 0)
        + parseInt(value.getG()).toString(16).padStart(2, 0)
        + parseInt(value.getB()).toString(16).padStart(2, 0)
        + (a === 255 ? "" : a.toString(16).padStart(2, 0));

      let short = true;
      let shortVal = "#";
      for(let i = 1; i < (a === 255 ? 6 : 8); i+=2) {
        if (val[i] !== val[i + 1]) {
          short = false
        } else {
          shortVal += val[i]
        }
      }
      if (short)
        val = shortVal;
    }
  } else if (value instanceof sass.types.List) {
    for (let i = 0; i < value.getLength(); ++i) {
      val += sassToString(value.getValue(i)) + " "
    }
    val = val.slice(0, -1)
  } else if (value instanceof sass.types.Map) {
    for (let i = 0; i < value.getLength(); ++i) {
      val += value.getKey(i) + ':' + sassToString(value.getValue(i)) + ","
    }
    val = '(' + val.slice(0, -1) + ')'
  } else if (value instanceof sass.types.Null) {
    val = ""
  } else if (value instanceof sass.types.Number) {
    val = value.getValue() + value.getUnit();
  } else {
    val = value.getValue();
  }
  return val
}

const postcss = require('postcss')
const autoprefixer = require('autoprefixer')
const postcssCalc = require('postcss-calc')
const cleanCSS = require('clean-css')

const writeOutput = (output, result) => {
  postcss([autoprefixer, postcssCalc]).process(result.css, {map: { prev: result.map.toString(), inline: false, sourcesContent: false }, from: output + ".css", to: output + '.css'}).then((result) => {
    fs.writeFile(output + '.css', result.css, (err) => err ? console.error(err) : console.log('wrote to ' + output + '.css'))
    fs.writeFile(output + '.css.map', result.map, (err) => err ? console.error(err) : console.log('wrote to ' + output + '.css.map'))

    fs.writeFile(output+'.min.css', new cleanCSS().minify(result.css).styles, (err) => err ? console.error(err) : console.log('wrote to ' + output + '.min.css'))
  });
}

const renderSassSync = (input, output, data, functions) => {
  data = data || "";
  data += '\n@import "' + input + '";'
  return sass.renderSync({
    data,
    outFile: output + '.css',
    includePaths: [path.resolve(process.cwd(), input)],
    outputStyle: 'expanded',
    sourceMap: true,
    sourceMapContents: true,
    functions
  });
}

module.exports = { ensureDirectoryExistence, writeOutput, renderSassSync, sassToString };