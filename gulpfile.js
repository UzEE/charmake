/// <reference path="./typings/index.d.ts" />

let gulp = require('gulp');
let lec = require('gulp-line-ending-corrector');

// correct line-endings
gulp.task('line-endings', () => {

  return gulp.src('bin/**/*.js')
    .pipe(lec())
    .pipe(gulp.dest('bin'));
});