
const gulp = require('gulp')
const jshint = require('gulp-jshint')
const del = require('del')
const exec = require('child_process').exec
const { Transform } = require('stream');
const conditionalLoader = require('webpack-conditional-loader')


function conditionalCompiler() {
    return new Transform({
        objectMode: true,
        transform(file, encoding, callback) {
            if (file.isBuffer()) {
                const content = file.contents.toString(encoding);
                file.contents = Buffer.from(conditionalLoader(content));
            }
            callback(null, file);
        }
    });
}

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
        .pipe(conditionalCompiler())
        .pipe(gulp.dest('dist/src'))
)

function nodeInstall(cb, extra) {
    exec(`npm ci ${extra} --prefix ./dist`, (err, stdout, stderr) => {
        console.log(stdout)
        console.log(stderr)
        if (err) {
            cb(err)
        } else {
            del('dist/package-lock.json', { force: true }).then(() => cb()).catch(cb)
        }
    })
}

gulp.task('node-insta', (cb) => { nodeInstall(cb, '') })
gulp.task('node-insta-p', (cb) => { nodeInstall(cb, '--omit=dev') })

gulp.task('build', gulp.series('clean', 'misc', 'index', 'node-insta-p'));
gulp.task('build-p', gulp.series('clean', 'misc', 'index', 'node-insta-p'));

module.exports = gulp
