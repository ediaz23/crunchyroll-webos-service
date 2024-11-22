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
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('node-fetch patched.')
    } catch (error) {
        console.error('Error patching node-fetch:', error);
    }
}

if (__dirname.endsWith('dist')) {
    patchNodeFetch()
}
