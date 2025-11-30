
import gulp, { task, src, dest, series } from 'gulp';
import jshint from 'gulp-jshint';
import terser from 'gulp-terser';
import babel from 'gulp-babel';
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

async function buildLib(lib) {
    const command = `
        npx babel dist/node_modules/${lib} --out-dir dist/node_modules/${lib} --extensions ".js,.jsx"
    `;
    return new Promise((res, rej) => {
        exec(command, (err, stdout, stderr) => {
            console.log(stdout)
            console.log(stderr)
            if (err) {
                rej(err)
            } else {
                res()
            }
        })
    })
}

task('clean', () =>
    deleteAsync('dist/**', { force: true })
)

task('misc', () =>
    src(['LICENSE', 'package.json', 'package-lock.json', 'services.json', 'patch-node-fetch.js'])
        .pipe(dest('dist'))
)

task('index', () => {
    const isProduction = process.env.NODE_ENV === 'production';
    let stream = src('src/index.js')

    stream = stream.pipe(jshint())
    stream = stream.pipe(jshint.reporter('default'))
    stream = stream.pipe(conditionalCompiler())
    stream = stream.pipe(babel())
    if (isProduction) {
        stream = stream.pipe(terser({
            compress: {
                ecma: 5,
                pure_getters: true,
                unsafe: true,
                unsafe_comps: true,
                toplevel: true
            },
            mangle: {
                toplevel: true
            },
            ecma: 5
        }))
    }
    stream = stream.pipe(dest('dist/src'))
    return stream
})

function nodeInstall(cb, extra) {
    exec(`npm ci ${extra} --prefix=./dist`, (err, stdout, stderr) => {
        console.log(stdout)
        console.log(stderr)
        if (err) {
            cb(err)
        } else {
            deleteAsync(['dist/package-lock.json', 'dist/patch-node-fetch.js'], { force: true })
                .then(() => cb()).catch(cb)
        }
    })
}

task('build-libs', (cb) => {
    Promise.all([
        buildLib('node-fetch'),
        buildLib('abort-controller'),
        buildLib('event-target-shim'),
    ]).then(() => cb()).catch(cb)
})

task('node-insta-dev', (cb) => { nodeInstall(cb, '') })
task('node-insta-prod', (cb) => { nodeInstall(cb, '--omit=dev') })

task('build-dev', series('clean', 'misc', 'index', 'node-insta-prod', 'build-libs'));
task('build-prod', series('clean', 'misc', 'index', 'node-insta-prod', 'build-libs'));

export default gulp
