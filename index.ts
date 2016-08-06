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

interface ICharacterSequenceMap {
  [character: string]: ICharacterSequence;
}

export interface IDataFileRecord {

  animation: string;
  x: number;
  y: number;
  width: number;
  height: number;
  design: string;
  overlay: boolean;
  framerate: number;
}

import * as yargs from 'yargs';
import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';
import * as gm from 'gm';
import * as async from 'async';
import * as ffmpeg from 'fluent-ffmpeg';
import * as _ from 'lodash';
import * as parse from 'csv-parse';

import * as updateNotifier from 'update-notifier';

// TODO: Find a more permanent solution to get package.json
const pkg = require(path.join('..', 'package.json'));

updateNotifier({pkg}).notify();

import { Processor, ICharacterSequence } from './lib/processor';

let argv = yargs
  .usage(util.format('Character Make v%s\n\nUsage: charmake <character> [args]', pkg.version))
  .help('help')
  .wrap(null)
  .version('v' + pkg.version)
  .option('input-character', {

    alias: 'i',
    demand: true,
    type: 'string',
    describe: 'Path to the Directory containing the character files to process'

  }).option('datafile', {

    alias: ['d', 'df'],
    type: 'string',
    describe: 'Path to the CSV data file for the character',
    demand: true

  }).option('output-dir', {
    alias: 'o',
    type: 'string',
    describe: 'Path to the Directory in which to output the generated character files',
    default: null

  }).option('width', {
    alias: 'w',
    type: 'number',
    describe: 'Width of the output in pixels.',
    default: null,
    defaultDescription: 'Will default to the size of overlay design file if omitted.'

  }).option('height', {
    alias: 'h',
    type: 'number',
    describe: 'Height of the output in pixels.',
    default: null,
    defaultDescription: 'If no --height is given but --width is, it\'s value will be used for --height as well, resulting in a square image. Otherwise, the size of overlay design file is used if omitted.'

  }).option('size', {
    alias: 's',
    type: 'string',
    describe: 'Output dimensions of the format <width>x<height> (e.g 512x512). This value will take precedence over --width and --height if given.',
    default: null,
    defaultDescription: 'Defaults to the size of design overlay file if --width and --height are also omitted.'

  }).option('framerate', {
    alias: ['fps', 'f'],
    type: 'number',
    describe: 'Framerate to use for the output animation.',
    default: 25,
    defaultDescription: 'Run at 25 frames/second by default.'
  })
  .option('verbose', {
    type: 'boolean',
    describe: 'Print debug logs to stdout.',
    default: false

  })
  .argv;

const input = path.normalize(argv['i']);
const output = argv['o'] ? path.normalize(argv['o']) : input;
const dataFile = argv['df'] ? path.normalize(argv['df']) : null;

/**
 * A helper function to write to stdout
 */
let consoleLog = (...args) => {

  if (argv['verbose']) {
    console.log.apply(this, args);
  }
};

let consoleError = (...args) => {

  if (argv['verbose']) {
    console.log.apply(this, args);
  }
};

// begin the process
async.waterfall([

  // parse --datafile first if given
  (cb: AsyncResultArrayCallback<IDataFileRecord>) => {

    consoleLog('[input] Using input character: %s', input);

    if (!dataFile) {

      let msg = '[datafile] No --datafile given as input.';
      cb(new Error(msg), null);
      return;
    }

    consoleLog('[datafile] Using CSV data file: %s', dataFile);

    let csv = fs.createReadStream(dataFile);
    let parser = parse({ delimiter: ',' });

    let data: Array<IDataFileRecord> = [];

    parser.on('readable', (arg) => {

      let row = null;

      while (row = parser.read()) {

        data.push({
          animation: row[0],
          x: parseInt(row[1]),
          y: parseInt(row[2]),
          width: parseInt(row[3]),
          height: parseInt(row[4]),
          design: row[5],
          overlay: row[6] == '0' ? false : true,
          framerate: row[7]
        });
      }
    });

    parser.on('error', (err) => {

      consoleError('[datafile] Error occured during parsing');
      cb(err, null);
    });

    parser.on('finish', () => {

      consoleLog('[datafile] Parsed the following data from CSV:');
      consoleLog(util.inspect(data));
      consoleLog('[datafile] Total animations parsed: %d', data.length);

      cb(null, data);
    });

    csv.pipe(parser);
  },

  // filter all top level directories first
  (data: Array<IDataFileRecord>, cb: AsyncResultArrayCallback<IDataFileRecord>) => {

    data = data.filter((record) => {
      return fs.statSync(path.resolve(process.cwd(), input, record.animation)).isDirectory();
    });

    consoleLog('[filter] Filtered the input animation count to: %d', data.length);
    consoleLog(data);

    cb(null, data);
  },

  // process each animation directory
  async (data: Array<IDataFileRecord>, cb: AsyncResultObjectCallback<ICharacterSequence>) => {

    let chars: { [character: string]: ICharacterSequence } = {};

    for (let i = 0, len = data.length; i < len; i++) {

      try {

        let char = await Processor.BuildCharacterSequenceAsync(input, data[i]);
        chars[char.animation] = char;

        consoleLog(`[sequence][%d] Processed animation '%s' with design '%s'`, i + 1, char.animation, char.designFile);
      }

      catch (err) {

        if (err.designMissing) {
          consoleError(err.message);
        }

        if (err.break) {

          cb(err, null);
          return;
        }
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
    let fps = argv['fps'];

    let vals = _.values(chars);

    async.forEachOfSeries(chars, (sequence: ICharacterSequence, animation, eachCb) => {

      let outdir = argv['o'] || input;
      let outname = path.join(outdir, animation + '.gif');
      let design = chars[animation].designFile;

      consoleLog('Creating %s', outname);

      async.waterfall([

        (waterfallCb) => {

          if (!size || size === '0x0') {

            gm(design)
              .size((err, dim) => {

                if (err) {

                  waterfallCb(err);
                  return;
                }

                size = util.format('%dx%d', dim.width, dim.height);
                waterfallCb(null, size);
              });

          } else {
            waterfallCb(null, size);
          }
        },

        (size: string, waterfallCb) => {

          consoleLog('Using size: %s', size);

          console.debug = (...args: Array<any>) => {
            consoleLog.apply(this, args);
          }

          let palette = new ffmpeg({ logger: console });
          let overlayInputs: Array<string> = [];

          let paletteName = path.join(input, animation, 'palette.png');
          //let palette = fs.createWriteStream(paletteName);

          if (sequence.data.overlay) {
            overlayInputs = ['fps', '1:v']
          } else {
            overlayInputs = ['1:v', 'fps'];
          }

          /*let filters: Array<FfmpegComplexFilter> = [

            {
              filter: 'color',
              options: { c: 'white', s: size },
              outputs: 'col'
            },

            {
              filter: 'fps',
              options: 25,
              inputs: ['0:v'],
              outputs: 'fps'
            },

            {
              filter: 'scale',
              options: { w: size.substring(0, size.indexOf('x')), h: size.substring(size.indexOf('x') + 1), flags: 'lanczos' },
              inputs: 'fps',
              outputs: 'scaled'
            },

            {
              filter: 'overlay',
              options: { x: 0, y: 0 },
              inputs: overlayInputs,
              outputs: 'overlayed'
            },

            {
              filter: 'split',
              options: '2',
              inputs: 'overlayed',
              outputs: ['y1', 'y2']
            },

            {
              filter: 'palettegen',
              options: { stats_mode: 'full' },
              inputs: 'y1',
              outputs: 'palette'
            },

            {
              filter: 'overlay',
              options: { x: 0, y: 0 },
              inputs: ['col', 'y2'],
              outputs: 'colored'
            },

            {
              filter: 'paletteuse',
              options: { dither: 'sierra2' },
              inputs: ['colored', 'palette']
            }
          ];*/

          let filters: Array<FfmpegComplexFilter> = [

            {
              filter: 'crop',
              options: { w: sequence.data.width, h: sequence.data.height, x: sequence.data.x, y: sequence.data.y },
              inputs: '0:v',
              outputs: 'cropped'
            },

            {
              filter: 'fps',
              options: fps,
              inputs: 'cropped',
              outputs: 'fps'
            },

            {
              filter: 'overlay',
              options: { x: 0, y: 0 },
              inputs: overlayInputs,
              outputs: 'overlayed'
            },

            {
              filter: 'scale',
              options: { w: size.substring(0, size.indexOf('x')), h: size.substring(size.indexOf('x') + 1), flags: 'lanczos' },
              inputs: 'overlayed',
              outputs: 'scaled'
            },

            {
              filter: 'palettegen',
              options: { stats_mode: 'full' },
              inputs: 'scaled'
            }
          ];

          let time = chars[animation].sequenceFiles.length / sequence.data.framerate;

          consoleLog('Total frames: %d\nUsing framerate: %d fps\nGIF Duration: %ds', chars[animation].sequenceFiles.length, argv['framerate'], time);

          palette
            .input(path.join(input, animation, chars[animation].patternFFMPEG))
            .input(design)
            .filterGraph(filters)
            .on('error', (err) => {

              consoleError('[%s] Error generating Palette\n', animation);
              console.log(err);
              waterfallCb(err);
            })
            .on('end', (stdout, stderr) => {

              consoleLog('[%s] Palette generation complete', animation);

              let gifFlters: Array<FfmpegComplexFilter> = [

                {
                  filter: 'color',
                  options: { c: 'white', s: size },
                  outputs: 'col'
                },

                {
                  filter: 'crop',
                  options: { w: sequence.data.width, h: sequence.data.height, x: sequence.data.x, y: sequence.data.y },
                  inputs: '0:v',
                  outputs: 'cropped'
                },

                {
                  filter: 'fps',
                  options: fps,
                  inputs: 'cropped',
                  outputs: 'fps'
                },

                {
                  filter: 'overlay',
                  options: { x: 0, y: 0 },
                  inputs: overlayInputs,
                  outputs: 'overlayed'
                },

                {
                  filter: 'scale',
                  options: { w: width, h: height, flags: 'lanczos' },
                  inputs: 'overlayed',
                  outputs: 'scaled'
                },

                {
                  filter: 'overlay',
                  options: { x: 0, y: 0 },
                  inputs: ['col', 'scaled'],
                  outputs: 'colored'
                },

                {
                  filter: 'paletteuse',
                  options: { dither: 'sierra2' },
                  inputs: ['colored', '2:v']
                }
              ];

              consoleLog('Using palette: %s', paletteName);

              let anim = new ffmpeg({ logger: console });

              anim
                .input(path.join(input, animation, chars[animation].patternFFMPEG))
                .input(design)
                .input(paletteName)
                .filterGraph(gifFlters)
                .on('error', (err) => {

                  consoleError('[%s] Error generating GIF\n', animation);
                  waterfallCb(err);
                })
                .on('end', (stdout, stderr) => {

                  consoleLog('[%s] GIF generation complete\n', animation);
                  waterfallCb(null, null);
                })
                .duration(time)
                .save(outname);
            })
            .save(paletteName);
        }
      ], (err, result) => {

        /*if (++count >= Object.keys(chars).length) {
          cb(null, chars);
        }*/

        eachCb(null);
      });

    }, (err) => {

      if (err) {
        return cb(err, null);
      }

      cb(null, chars);
    });
  }

], (err, results) => {

  if (err) {

    consoleError(err);
    return;
  }

  consoleLog('Finishing generation of GIF files...');
  return;
});