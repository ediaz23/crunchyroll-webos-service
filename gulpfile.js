
const gulp = require('gulp')
const jshint = require('gulp-jshint')
const del = require('del')
const exec = require('child_process').exec


gulp.task('clean', function() {
    return del('dist/**', { force: true });
})

gulp.task('misc', () =>
    gulp.src(['LICENSE', 'package.json', 'package-lock.json', 'services.json'])
        .pipe(gulp.dest('dist'))
)

gulp.task('index', () =>
    gulp.src('src/index.js')
        .pipe(jshint())
        .pipe(jshint.reporter('default'))
        .pipe(gulp.dest('dist/src'))
)

gulp.task('logger', () =>
    gulp.src('src/logger.js')
        .pipe(jshint())
        .pipe(jshint.reporter('default'))
        .pipe(gulp.dest('dist/src'))
)

gulp.task('node-insta', (cb) => {
    exec('npm install --prefix ./dist', (err, stdout, stderr) => {
        console.log(stdout)
        console.log(stderr)
        if (err) {
            cb(err)
        } else {
            del('dist/package-lock.json', { force: true }).then(() => cb()).catch(cb)
        }
    })
})
gulp.task('build', gulp.series('clean', 'misc', 'index', 'logger', 'node-insta'));

gulp.task('node-insta-p', (cb) => {
    exec('npm ci --omit=dev --prefix ./dist', (err, stdout, stderr) => {
        console.log(stdout)
        console.log(stderr)
        if (err) {
            cb(err)
        } else {
            del('dist/package-lock.json', { force: true }).then(() => cb()).catch(cb)
        }
    })
})
gulp.task('build-p', gulp.series('clean', 'misc', 'index', 'logger', 'node-insta-p'));

module.exports = gulp
