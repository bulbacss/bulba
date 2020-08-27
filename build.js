#!/usr/bin/env node

const program = require('commander');

const { version } = require('./package.json');

const path = require('path');

const { ensureDirectoryExistence, renderSassSync, writeOutput, watch, unwatch } = require("./utils");

program
  .arguments('<cmd> <input> <output>')
  .version(version, '-v, --version', 'output the current version')
  .usage('input.sass output.css [options]')
  .option('-t, --themeable [full]', 'Output optimized themes or non optimized if using full')
  .option('-s, --min', 'Also output minified files')
  .option('-m, --map', 'Also output map files')
  .option('-r --rtl', 'Build in rtl mode')
  .option('-w --watch', 'Watch for file change and recompile')
  .parse(process.argv);

if (program.args.length < 2) {
  program.outputHelp(() => program.help());
}

const input = path.resolve(process.cwd(), program.args[0]);

if (path.parse(program.args[0]).ext !== ".sass" && path.parse(program.args[0]).ext !== ".scss") {
  console.error("The input file must be a sass or scss file")
  process.exitCode = 1;
  return;
}

const outInfo = path.parse(program.args[1])

const output = path.resolve(process.cwd(), outInfo.dir + path.sep + outInfo.name);

const shouldWatch = program.watch;

let variables = {};

if (program.rtl) {
  variables.rtl = true
}

const build = async () => {
  ensureDirectoryExistence(output);

  if (!program.themeable) {
    //No variables build
    variables.themeable = false
    const render = renderSassSync(input, output, variables);
    //Output the non themeable generated css
    await writeOutput(output, render, program);
    return render;
  } else {
    variables.themeable = program.themeable === 'full' ? "full" : true;

    let render = renderSassSync(input, output, variables);

    await writeOutput(output, render, program);
    return render;
  }
}

build().then(render => {

  if (shouldWatch) {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    const watcher = async (file) => {
      console.log("\nFile " + file + " has been touched, recompiling\n");
      unwatch();
      try {
        render = await build();
      } catch (e) {
        console.error(e);
      }
      watch(render, watcher);

      rl.question('Continuing watcher, press enter to exit', (answer) => {
        rl.close();
        unwatch();
      });
    }
    watch(render, watcher)
    rl.question('Started watcher, press enter to exit', (answer) => {
      rl.close();
      unwatch();
    });
  }
});
