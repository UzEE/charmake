/// <reference path="./typings/index.d.ts" />

let gulp = require('gulp');
let lec = require('gulp-line-ending-corrector');
let ts = require('gulp-typescript');
let sourcemaps = require('gulp-sourcemaps');

// compile and build the project
gulp.task('default', () => {

  let tsProject = ts.createProject('tsconfig.json');

  let tsResult = tsProject.src('src/**/*.ts')
    .pipe(sourcemaps.init())
    .pipe(ts(tsProject, undefined, ts.reporter.defaultReporter()));

  return tsResult.js
    .pipe(sourcemaps.write('./'))
    .pipe(lec())
    .pipe(gulp.dest('bin'));
});
