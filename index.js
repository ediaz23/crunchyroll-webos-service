
const logger = require('./logger')
const fetch = require('node-fetch')

const SERVICE_NAME = 'com.crunchyroll.stream.app.service'
logger.info(SERVICE_NAME)

/** @type {import('webos-service').default} */
let service = null

try {
    const Service = require('webos-service')
    service = new Service(SERVICE_NAME)
} catch (_e) {
    service = {
        register: function(name, fn) {
            this[name] = fn
        }
    }
}

/**
 * @param {import('webos-service').Message} message
 * @param {Error} error
 * @param {String} name
 */
const errorHandler = (message, error, name) => {
    if (error instanceof Error) {
        message.respond({ returnValue: false, error: `${error.name} - ${error.message}`, stack: error.stack })
    } else {
        message.respond({ returnValue: false, error: JSON.stringify(error) })
    }
    logger.error(name)
    logger.error(error)
}

/**
 * Fix for old node version
 */
function fromEntries(headers) {
    const result = {}
    for (const [key, value] of Object.entries(headers)) {
        result[key] = value
    }
    return result;
}


service.register('forwardRequest', async message => {
    try {
        const { url } = message.payload
        delete message.payload.url
        /** @type {import('node-fetch').RequestInit}*/
        const body = message.payload
        if (body.headers && body.headers['Content-Type'] === 'application/octet-stream' && body.body) {
            body.body = Buffer.from(body.body, 'base64')
        }
        /** @type {import('node-fetch').Response}*/
        const result = await fetch(url, body)
        const data = await result.arrayBuffer()
        const content = Buffer.from(data).toString('base64')
        const headers = fromEntries(result.headers)
        message.respond({
            status: result.status,
            statusText: result.statusText,
            headers: headers,
            content,
            resUrl: result.url
        })
    } catch (error) {
        errorHandler(message, error, 'forwardRequest')
    }
})

module.exports = {
    webosService: service
}
