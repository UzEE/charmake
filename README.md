Character Make
==============

A simple command line utility for generating character GIFs with overlays.

## Install

Make sure you have [Node](http://nodejs.org/) (v6.2.1 or higher). You will also need the latest [FFMPEG](https://ffmpeg.org/download.html) along with [Graphicsmagick](http://graphicsmagick.org) installed and available in your environment `PATH`. Then:

```shell
npm install charmake -g
```

## Usage

Organize your character's animation sequences into the following directory structure.

```
root/
|
|_design/
| |
| |_design1.png
| |_design2.png
| |_...
| |_designN.png
|
|_character/
  |_sequenceA/
  | |
  | |_sequenceA0000.png
  | |_sequenceA0001.png
  | |_sequenceA0002.png
  | |_...
  | |_sequenceAXXXX.png
  |
  |_sequenceB/
  | |
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
    |_sequenceZ0000.png
    |_sequenceZ0001.png
    |_sequenceZ0002.png
    |_...
    |_sequenceZXXXX.png

```

The are only a couple of requirements here that you need to follow: 

1. The name of your animation sequences and their directory be same and only consist of letters and underscore (e.g. `sequenceA` and `sequenceA0003.png`, or `victory_dance` and `victory_dance0054.png`).
2. There should be a directory called `design` adjecent to the character directory that contains all the design files (overlay and underlay).
3. A comma delimited [CSV data file](#data_file_structure) containing a list of all the animations in the character along with any croping parameters, it's design file and it's original framerate.

If the conditions are met, then all you need to do is run the following from your terminal or command line:

```shell
charmake -i path_to_my_character_dir -d path_to_csv_data_file
```

The above command will use FFMPEG as the GIF generation library. Animation files for your character will be created inside the charcter's directory upon success. Output directory can be changed by using `--output-dir` parameter. You can also get a 
list of all the options available by runing:

```shell
charmake --help
```

### Parameters

Most options use sane defaults so you should be good to go without specifying anything additional besides input.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| --input-dir, -i | Directory Path | _Required_ | The path to the character directory containing all the animation directories |
| --datafile, -d, --df | Data File Path | _Required_ | Path to the CSV data file for the character |
| --output-dir, -o | Output Directory Path | Input Directory | Path to the Directory in which to output the generated character files |
| --width, -w | Number | Design file Width | Width of the output in pixels. Will default to the size of overlay design file if omitted. |
| --height, -h | Number | Same as Width | Height of the output in pixels. If no `--height` is given but `--width` is, it's value will be used for `--height` as well, resulting in a square image. Otherwise, the size of overlay design file is used if omitted. |
| --size, -s | String |  | Output dimensions of the format <width>x<height> (e.g 512x512). This value will take precedence over `--width` and `--height` if given. Defaults to the size of design overlay file if `--width` and `--height` are also omitted. |
| --framerate, --fps, -f | Number | 25 | Framerate to use for the output animation. Runs at 25 frames/second by default. |
| --verbose | Boolean | False | Print debug logs to stdout |
| --version | | | Shows version information |
| --help | | | Shows detailed help about the command utility |

## Data File Structure

The CSV data file needs to follow the following structure:

```
Column 1: animation directory name (string),
Column 2: crop start X (number),
Column 3: crop start Y (number),
Column 4: crop width (number),
Column 5: crop height (number),
Column 6: design_file (string),
Column 7: 0 for underlay OR 1 for overlay,
Column 8: framerate (number)
```

For example, the third line describes an animation in directory called `dismissing_gesture`, croping the frames starting from `0x0` and a total size of `1000x1000`. It's design file is named `NotInterested.png` which is overlayed (`1`) over the frames. It's framerate is `30` frames/sec.

```
cheerings,0,0,1000,1000,Swag.png,1,30
cocky_head_turn,0,0,1000,1000,Whatever.png,1,30
dismissing_gesture,0,0,1000,1000,NotInterested.png,1,30
ducking,0,0,1000,1000,Ouch.png,0,30
dying,0,0,1000,1000,MissYou.png,0,30
fist_pump,0,0,1000,1000,Awesome.png,0,30
fist_pumps,0,0,1000,1000,NailedIt.png,0,30
talking,0,0,1000,1000,Thankyou.png,0,30
hanging_idle,0,0,1000,1000,HangingIn.png,1,30
```

## License

(The MIT License)

Copyright (c) 2016 [Uzair Sajid](http://uzairsajid.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.