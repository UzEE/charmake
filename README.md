Character Make
==============

A simple command line utility for generating character GIFs with overlays.

## Install

Make sure you have [Graphicsmagick](http://graphicsmagick.org) installed and available in your environment `PATH`. Then:

```bash
npm install charmake -g
```

## Usage

Organize your character's animation sequences into the following directory structure.

```
root/
|
|_sequenceA/
| |
| |_design.over.png
| |_sequenceA0000.png
| |_sequenceA0001.png
| |_sequenceA0002.png
| |_...
| |_sequenceAXXXX.png
|
|_sequenceB/
| |
| |_design.under.png
| |_sequenceB0000.png
| |_sequenceB0001.png
| |_sequenceB0002.png
| |_...
| |_sequenceBXXXX.png
|
|_...
|
|_sequenceZ/
  |
  |_design.under.png
  |_sequenceZ0000.png
  |_sequenceZ0001.png
  |_sequenceZ0002.png
  |_...
  |_sequenceZXXXX.png

```

The are only a couple of requirements here that you need to follow: 

1. The name of your animation sequences and their directory be same and only consist of letters and underscore (e.g. `sequenceA` and `sequenceA0003.png`, or `victory_dance` and `victory_dance0054.png`).
2. There should be a file called `design.over.png` or `design.under.png` in the sequence directory which will be used as an over or underlay respectively.

If the conditions are met, then all you need to do is run the following from your terminal or command line:

```bash
charmake -i path_to_my_character_dir
```

Animation files for your character will be created inside the charcter's root directory upon success. You can also get a 
list of all the options available by runing:

```bash
charmake --help
```

Most options use sane defaults so you should be good to go without specifying anything additional besides input.

## License

(The MIT License)

Copyright (c) 2016 [Uzair Sajid](http://uzairsajid.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.