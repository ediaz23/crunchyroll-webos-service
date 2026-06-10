const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, 'dist/node_modules/node-fetch/lib/index.js');

if (fs.existsSync(filePath)) {

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
        console.log('node-fetch error', error);
    }
} else {
    console.log('node-fetch file not found', filePath);
}
