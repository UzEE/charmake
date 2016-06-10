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
};

import * as yargs from 'yargs';
import * as path from 'path';
import * as fs from 'fs';

import pad = require('pad-left');

let argv = yargs
  .usage('$0 <cmd> [args]')
  .help('help')
  .option('input-dir', {
    alias: 'i',
    demand: true,
    type: 'string',
    describe: 'Path to the Directory containing the files to rename'
  })
  .option('output-dir', {
    alias: 'o',
    type: 'string',
    describe: 'Path to the Directory to output the renamed files',
    default: null
  })
  .argv;

const input = path.normalize(argv['i']);
const output = argv['o'] ? path.normalize(argv['o']) : input;

const nameRegEx = /^([a-z]+)([0-9]+)(\.[a-z]+)$/i;

let dictionary: IFileDictionary = {};

let max: number = 0;
let indexStrLength: number;

fs.readdir(input, (err, files) => {

  if (err) {
    console.error(err);
    return;
  }

  console.log('Total files found: %d', files.length);

  files.forEach((file, i) => {

    let result = file.match(nameRegEx);
    let [filename, name, index, ext] = result;
    let numIndex: number = parseInt(index);

    max = Math.max(max, numIndex);
    indexStrLength = index.length;

    dictionary[numIndex] = {

      filename: filename,
      name: name,
      index: numIndex,
      extension: ext
    };

    console.log('File: %s [Name: %s, Index: %d, Extension: %s]', filename, name, index, ext);
  });

  if (max + 1 !== files.length) {

    console.error('File indexes don\'t match the total number of files.\nMax Index: %d, Total Files: %d', max + 1, files.length);
    process.exit(2);
  }

  let indexes = Object.keys(dictionary).map<number>(i => parseInt(i)).sort((a, b) => { return b - a });

  let getName = (item: IFileDictionaryItem, index: number) => {
    return [item.filename, item.name + pad(index.toString(), indexStrLength, '0') + item.extension];
  };

  console.log('Startig to rename...');

  for (let i = 0; i <= max / 2; i++) {

    let file = dictionary[indexes[i]];
    let [first_filename, first_newName] = getName(file, i);

    file = dictionary[indexes[indexes.length - 1 - i]];
    let [second_filename, second_newName] = getName(file, indexes.length - 1 - i);

    let temp_newName = first_newName + '.bak';

    fs.renameSync(path.join(input, first_filename), path.join(output, temp_newName));
    fs.renameSync(path.join(input, second_filename), path.join(output, second_newName));
    fs.renameSync(path.join(input, temp_newName), path.join(output, first_newName));

    if (i + 1 >= max / 2) {

      if (max % 2) {

        file = dictionary[indexes[i + 1]];
        [first_filename, first_newName] = getName(file, i + 1);

        fs.renameSync(path.join(input, first_filename), path.join(output, first_newName));
        break;

      } else {
        break;
      }

    }
  }

});


