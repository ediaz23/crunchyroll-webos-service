
import gulp, { task, src, dest, series } from 'gulp';
import jshint from 'gulp-jshint';
import { deleteAsync } from 'del';
import { exec } from 'child_process';
import { Transform } from 'stream';
import conditionalLoader from 'webpack-conditional-loader';


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

task('clean', function() {
    return deleteAsync('dist/**', { force: true });
})

task('misc', () =>
    src(['LICENSE', 'package.json', 'package-lock.json', 'services.json'])
        .pipe(dest('dist'))
)

task('index', () =>
    src('src/index.js')
        .pipe(jshint())
        .pipe(jshint.reporter('default'))
        .pipe(conditionalCompiler())
        .pipe(dest('dist/src'))
)

function nodeInstall(cb, extra) {
    exec(`npm ci ${extra} --prefix ./dist`, (err, stdout, stderr) => {
        console.log(stdout)
        console.log(stderr)
        if (err) {
            cb(err)
        } else {
            deleteAsync('dist/package-lock.json', { force: true }).then(() => cb()).catch(cb)
        }
    })
}

task('node-insta', (cb) => { nodeInstall(cb, '') })
task('node-insta-p', (cb) => { nodeInstall(cb, '--omit=dev') })

task('build', series('clean', 'misc', 'index', 'node-insta-p'));
task('build-p', series('clean', 'misc', 'index', 'node-insta-p'));

export default gulp
