#!/usr/bin/env node

/// <reference path="./typings/index.d.ts" />

interface IFileDictionaryItem {

  name: string,
  index: number,
  extension: string,
  filename: string
}

interface IFileDictionary {
  [index: number]: IFileDictionaryItem;
}

import * as yargs from 'yargs';
import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';
import * as gm from 'gm';
import * as async from 'async';

import * as updateNotifier from 'update-notifier';

// TODO: Find a more permanent solution to get package.json
const pkg = require(path.join('..', 'package.json'));

updateNotifier({pkg}).notify();

import { Processor, ICharacterSequence } from './lib/processor';

let argv = yargs
  .usage(util.format('Character Make v%s\n\nUsage: charmake <cmd> [args]', pkg.version))
  .help('help')
  .wrap(null)
  .version('v' + pkg.version)
  .option('input-dir', {

    alias: 'i',
    demand: true,
    type: 'string',
    describe: 'Path to the Directory containing the files to rename'

  }).option('output-dir', {
    alias: 'o',
    type: 'string',
    describe: 'Path to the Directory to output the renamed files',
    default: null

  }).option('width', {
    alias: 'w',
    type: 'number',
    describe: 'Width of the output in pixels.',
    default: null,
    defaultDescription: 'Will default to the size of `design.png` if omitted.'

  }).option('height', {
    alias: 'h',
    type: 'number',
    describe: 'Height of the output in pixels.',
    default: null,
    defaultDescription: 'If --width is given, it\'s value will be used for --height as well, resulting in a square image. Otherwise, size of `design.png` will be used.'

  }).option('size', {
    alias: 's',
    type: 'string',
    describe: 'Output dimensions of the format <width>x<height> (e.g 512x512). This value will take precedence over --width and --height if given.',
    default: null,
    defaultDescription: 'Defaults to the size of `design.png` if ommited.'

  }).option('verbose', {
    type: 'boolean',
    describe: 'Print output to stdout',
    default: false

  }).argv;

const input = path.normalize(argv['i']);
const output = argv['o'] ? path.normalize(argv['o']) : input;

interface ICharacterSequenceMap {
  [character: string]: ICharacterSequence;
}

/**
 * A helper function to write to stdout
 */
let consoleLog = (...args) => {

  if (argv['verbose']) {
    console.log.apply(this, args);
  }
};

// begin the process
async.waterfall([

  // filter all top level directories first
  (cb: AsyncResultArrayCallback<string>) => {

    fs.readdir(input, (err, files) => {

      if (err) {

        cb(err, null);
        return;
      }

      files = files.filter(file => {
        return fs.statSync(path.resolve(process.cwd(), input, file)).isDirectory();
      });

      consoleLog(files);

      cb(null, files);
      return;
    });
  },

  // process each animation directory
  async (directories: Array<string>, cb: AsyncResultObjectCallback<ICharacterSequence>) => {

    let chars: { [character: string]: ICharacterSequence } = {};

    for (let i = 0, len = directories.length; i < len; i++) {

      try {
        let char = await Processor.BuildCharacterSequenceAsync(path.join(input, directories[i]));
        chars[char.name] = char;
      }

      catch (err) {

        cb(err, null);
        return;
      }
    }

    cb(null, chars);
  },

  // make gifs for each character
  (chars: Dictionary<ICharacterSequence>, cb: AsyncResultObjectCallback<ICharacterSequence>) => {

    let count = 0;

    let width = parseInt(argv['width']) || null;
    let height = parseInt(argv['height']) || width;

    let size = argv['size'] || util.format('%dx%d', width, height);

    for (let char in chars) {

      let outname = path.join(input, char + '.gif');
      let out = fs.createWriteStream(outname);

      let design = path.join(input, char, chars[char].designFile);

      consoleLog('Creating %s', outname);

      async.waterfall([

        (cb) => {

          if (!size || size === '0x0') {

            gm(design)
              .size((err, dim) => {

                if (err) {

                  cb(err);
                  return;
                }

                size = util.format('%dx%d', dim.width, dim.height);
                cb(null, size);
              });

          } else {
            cb(null, size);
          }
        },

        (size: string, cb) => {

          consoleLog('Using size: %s', size);

          let anim = gm();

          if (design.indexOf('under') > 0) {

            anim.in('-dispose', 'none')
            .in('-geometry', size)
            .in(design)
            .in('-dispose', 'previous')
            .in('-delay', '1')
            .in('-loop', '0')
            .in('-geometry', size)
            .in(path.join(input, char, chars[char].pattern));;
          }

          if (design.indexOf('over') > 0) {

            anim.in('-dispose', 'none')
            .in('-delay', '1')
            .in('-loop', '0')
            .in('-geometry', size)
            .in(path.join(input, char, chars[char].pattern))
            .in('-dispose', 'background')
            .in('-geometry', size)
            .in(design);
          }

          /*for (let seq of chars[char].sequenceFiles) {
            anim = anim.in(path.join(input, char, seq));
          }*/

          anim.stream('gif')
            .pipe(out);

          cb(null, null);
        }
      ], (err, result) => {

        if (++count >= Object.keys(chars).length) {
          cb(null, chars);
        }
      });
    }
  }

], (err, results) => {

  if (err) {

    console.error(err);
    return;
  }

  consoleLog('Finishing generation of GIF files...');
  return;
});