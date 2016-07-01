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
import * as ffmpeg from 'fluent-ffmpeg';
import * as _ from 'lodash';

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

  })
  .option('processor', {
    alias: 'p',
    type: 'string',
    describe: 'Defines which image processor to use. Valid values are "gm" for GraphicsMagick and "ffmpeg" for FFMPEG.',
    default: 'ffmpeg',
    defaultDescription: 'Defaults to using FFMPEG for Gif generation.'

  })
  .option('ffmpeg', {
    type: 'boolean',
    describe: 'Short for using "--processor ffmpeg".',
    default: true,
    defaultDescription: 'Defaults to using FFMPEG for Gif generation.'

  })
  .option('gm', {
    type: 'boolean',
    describe: 'Short for using "--processor gm".',
    default: false,
    defaultDescription: 'Don\'t use GraphicsMagick by default.'

  })
  .option('framerate', {
    alias: ['fps', 'f'],
    type: 'number',
    describe: 'Framerate to use for the output animation.',
    default: 25,
    defaultDescription: 'Run at 25 frames/second by default.'
  })
  .argv;

const input = path.normalize(argv['i']);
const output = argv['o'] ? path.normalize(argv['o']) : input;

// determine which Gif processor to use
const processor = (argv['gm'] || argv['processor'] === 'gm') ? 'gm' : 'ffmpeg';

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

let consoleError = (...args) => {

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

    let vals = _.values(chars);

    async.forEachOfSeries(chars, (character, char, eachCb) => {

      let outname = path.join(input, char + '.gif');

      let design = path.join(input, char, chars[char].designFile);

      consoleLog('\nCreating %s', outname);

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

          // graphicsmagick pipeline
          let processGM = () => {

            let anim = gm();
            let out = fs.createWriteStream(outname);

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

            /**
             * Another command to try
             *
             * gm convert -dispose none -geometry 512x512 -background #fff -extent 0x0 design.under.png -dispose previous -delay 1 -loop 0 -geometry 512x512 -background #fefefe -extent 0x0 -transparent #fefefe backflip*.png test.gif
             */

            /*for (let seq of chars[char].sequenceFiles) {
              anim = anim.in(path.join(input, char, seq));
            }*/

            anim.stream('gif')
              .pipe(out);

            waterfallCb(null, null);
          }

          // ffmpeg pipeline
          let processFFMPEG = () => {

            consoleLog('Using %s as the processor library...', processor);

            console.debug = (...args: Array<any>) => {
              consoleLog.apply(this, args);
            }

            let palette = new ffmpeg({ logger: console });
            let overlayInputs: Array<string> = [];

            let paletteName = path.join(input, char, 'palette.png');
            //let palette = fs.createWriteStream(paletteName);

            if (design.indexOf('under') > 0) {

              overlayInputs = ['1:v', 'scaled'];

            } else {
              overlayInputs = ['scaled', '1:v']
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
                filter: 'palettegen',
                options: { stats_mode: 'full' },
                inputs: 'overlayed'
              }
            ];

            let time = chars[char].sequenceFiles.length / argv['framerate'];

            consoleLog('Total frames: %d\nUsing framerate: %d fps\nGIF Duration: %ds', chars[char].sequenceFiles.length, argv['framerate'], time);

            palette
              .input(path.join(input, char, chars[char].patternFFMPEG))
              .input(design)
              .filterGraph(filters)
              .on('error', (err) => {

                consoleError('[%s] Error generating Palette\n', char);
                console.log(err);
                waterfallCb(err);
              })
              .on('end', (stdout, stderr) => {

                consoleLog('[%s] Palette generation complete', char);

                let gifFlters: Array<FfmpegComplexFilter> = [

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
                    filter: 'overlay',
                    options: { x: 0, y: 0 },
                    inputs: ['col', 'overlayed'],
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
                  .input(path.join(input, char, chars[char].patternFFMPEG))
                  .input(design)
                  .input(paletteName)
                  .filterGraph(gifFlters)
                  .on('error', (err) => {

                    consoleError('[%s] Error generating GIF\n', char);
                    waterfallCb(err);
                  })
                  .on('end', (stdout, stderr) => {

                    consoleLog('[%s] GIF generation complete\n', char);
                    waterfallCb(null, null);
                  })
                  .duration(time)
                  .save(outname);
              })
              .save(paletteName);
          };

          if (processor === 'gm') {

            processGM();

          } else {
            processFFMPEG();
          }

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