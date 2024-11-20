const fs = require('fs');
const path = require('path');

function patchNodeFetch() {
    const filePath = path.resolve(
        __dirname,
        'node_modules/node-fetch/lib/index.js'
    );

    try {
        let content = fs.readFileSync(filePath, 'utf8');

        content = content.replace(
            /class Headers\s*{\s*([\s\S]*?)\n}/,
            (match, classBody) => {
                const updatedClassBody = classBody.replace(
                    /\[Symbol\.iterator\]\s*\(\)\s*{\s*return\s*createHeadersIterator\(this, 'key\+value'\);\s*}/g,
                    ''
                );
                return `class Headers {
                ${updatedClassBody.replace(
                    /constructor\s*\(\)\s*{\s*/,
                    `constructor() {
                        this[Symbol.iterator] = function () {
                            return createHeadersIterator(this, 'key+value');
                        };
                        `
                )}
            }`;
            }
        );
        content = content.replace(
            "var zlib = _interopDefault(require('zlib'));",
            `
      var zlib = _interopDefault(require('zlib'));
      var Buffer = require('../../buffer').Buffer;`)

        fs.writeFileSync(filePath, content, 'utf8');
        console.log('node-fetch patched.')
    } catch (error) {
        console.error('Error patching node-fetch:', error);
    }
}

function patchNodeBuffer() {
    const filePath = path.resolve(
        __dirname,
        'node_modules/buffer/index.js'
    );

    try {
        let content = fs.readFileSync(filePath, 'utf8');

        content = content.replace(
            /Buffer\.concat\s*=\s*function\s*concat\s*\(list,\s*length\)\s*{[\s\S]*?^\}\n/m,
            (match, classBody) => match.replace('let i', `  let i
  for (i = 0; i < list.length; ++ i) {
      if (global.Buffer.isBuffer(list[i])) {
          list[i] = Buffer.from(list[i]);
      }
  }`)
        )
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('node-fetch buffer.')
    } catch (error) {
        console.error('Error patching buffer:', error);
    }
}

if (__dirname.endsWith('dist')) {
    patchNodeFetch()
    patchNodeBuffer()
}
