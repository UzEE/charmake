'use strict';

import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

import pad = require('pad-left');

export interface ICharacterSequence {

  name: string;
  pattern: string;
  designFile: string;
  sequenceFiles: Array<string>;
}

interface IFileDictionaryItem {

  name: string,
  index: number,
  extension: string,
  filename: string
}

interface IFileDictionary {
  [index: number]: IFileDictionaryItem;
}

export class Processor {

  static SequencePattern = /^([a-z_\-]+)([0-9]+)(\.[a-z]+)$/i;

  static async BuildCharacterSequenceAsync(directory: string): Promise<ICharacterSequence> {

    directory = path.normalize(directory);

    return new Promise<ICharacterSequence>((resolve, reject) => {

      // check if design.over.png or design.under.png exists
      let designExists = new Promise<string>((designResolve, designReject) => {

        fs.exists(path.join(directory, 'design.under.png'), (exists) => {

          if (exists) {
            designResolve('design.under.png');
          } else {

            fs.exists(path.join(directory, 'design.over.png'), (exists) => {

              if (exists) {
                designResolve('design.over.png');
              } else {
                designReject(new Error(util.format('Error [%s]: design.over.png or design.under.png doesn\'t exist', directory)));
              }
            });
          }
        });
      });

      // check if valid sequence files exist
      let sequenceExists = new Promise<Array<string>>(async (seqResolve, seqReject) => {

        fs.readdir(directory, async (err, files) => {

          if (err) {

            seqReject(err);
            return;
          }

          files = files.filter(file => {
            return Processor.SequencePattern.test(file);
          });

          if (!files.length) {

            seqReject(new Error(util.format('Error [%s]: No valid animation sequence exists', directory)));
            return;
          }

          let newList = await Processor.ReverseSequenceAsync(directory, files);

          seqResolve(files);
        });
      });

      Promise.all([designExists, sequenceExists])
        .then(result => {

          let res = path.basename(result[1][0]).match(Processor.SequencePattern);
          let [filename, name, index, ext] = res;

          resolve({
            name: path.basename(directory),
            pattern: name + '*' + ext,
            designFile: result[0] ? result[0] : null,
            sequenceFiles: result[1]
          });
        })
        .catch(reason => {
          reject(reason);
        });
    });
  }

  static async ReverseSequenceAsync(directory: string, files: Array<string>): Promise<Array<string>> {

    return new Promise<Array<string>>((resolve, reject) => {

      let min = Number.POSITIVE_INFINITY;
      let max = 0;
      let indexStrLength: number;

      let dictionary: IFileDictionary = {};

      let outList: Array<string> = [];

      files.forEach((file, i) => {

        let result = path.basename(file).match(Processor.SequencePattern);
        let [filename, name, index, ext] = result;
        let numIndex: number = parseInt(index);

        min = Math.min(min, numIndex);
        max = Math.max(max, numIndex);
        indexStrLength = index.length;

        dictionary[numIndex] = {

          filename: filename,
          name: name,
          index: numIndex,
          extension: ext
        };

      });

      if ((max - min) + 1 !== files.length) {

        reject(new Error(util.format('File indexes don\'t match the total number of files.\nMax Index: %d, Total Files: %d', max + 1, files.length)));
        return;
      }

      let indexes = Object.keys(dictionary).map<number>(i => parseInt(i)).sort((a, b) => { return b - a });

      let getName = (item: IFileDictionaryItem, index: number) => {
        return [item.filename, item.name + pad((min + index).toString(), indexStrLength, '0') + item.extension];
      };

      let i = 0;
      let len = Math.floor(files.length / 2);

      for (; i < len; i++) {

        let fileDict = dictionary[indexes[i]];
        let [filename, newName] = getName(fileDict, i);

        let temp_newName = newName + '.bak';

        try {
          fs.renameSync(path.join(directory, filename), path.join(directory, temp_newName));
          fs.renameSync(path.join(directory, newName), path.join(directory, filename));
          fs.renameSync(path.join(directory, temp_newName), path.join(directory, newName));
        }

        catch (err) {

          reject(err);
          return;
        }

        outList.push(path.join(directory, filename));
        outList.push(path.join(directory, newName));

        /*if (i + 1 >= max / 2) {

          if (max % 2) {

            fileDict = dictionary[indexes[i + 1]];
            [filename, newName] = getName(fileDict, i + 1);

            try {
              fs.renameSync(path.join(directory, filename), path.join(directory, newName));
            }

            catch (err) {

              reject(err);
              return;
            }

            outList.push(path.join(directory, filename));
            break;

          } else { break; }
        }*/
      }

      if (files.length % 2) {

        let fileDict = dictionary[indexes[i]];
        let [filename, newName] = getName(fileDict, i);

        outList.push(path.join(directory, filename));
      }

      outList = outList.sort();

      resolve(outList);
    });
  }
}
