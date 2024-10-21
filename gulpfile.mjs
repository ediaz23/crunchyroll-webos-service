
import gulp, { task, src, dest, series } from 'gulp';
import jshint from 'gulp-jshint';
import { deleteAsync } from 'del';
import { exec } from 'child_process';
import { Transform } from 'stream';
import conditionalLoader from 'webpack-conditional-loader';
import terser from 'gulp-terser';


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

task('index', () => {
    const isProduction = process.env.NODE_ENV === 'production';
    let stream = src('src/index.js')
    stream = stream.pipe(jshint())
    stream = stream.pipe(jshint.reporter('default'))
    stream = stream.pipe(conditionalCompiler())
    if (isProduction) {
        stream = stream.pipe(terser())
    }
    stream = stream.pipe(dest('dist/src'))
    return stream
}
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
