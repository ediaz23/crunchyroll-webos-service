"use strict";
const fetch = require('node-fetch')
const https = require('https')


/** @type {import('webos-service').default} */
let service = null

try {
    const SERVICE_NAME = 'com.crunchyroll.stream.app.service'
    const Service = require('webos-service')
    service = new Service(SERVICE_NAME)
    console.info(SERVICE_NAME)
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
const errorHandler = (message, error, name, url, body) => {
    if (error instanceof Error) {
        message.respond({ returnValue: false, error: `${error.name} - ${error.message}`, stack: error.stack })
    } else {
        message.respond({ returnValue: false, error: JSON.stringify(error) })
    }
    if (error && 'status' in error) {
        console.error(name, body.method || 'get', url, result.status)
    } else {
        console.error(name, body.method || 'get', url, error)
    }
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

const agent = new https.Agent({ rejectUnauthorized: false })

service.register('forwardRequest', async message => {
    /** @type {{url: String}} */
    const { url } = message.payload
    delete message.payload.url
    /** @type {import('node-fetch').RequestInit}*/
    const body = message.payload
    try {
        console.log('  forwardRequest', body.method || 'get', url)
        if (body.headers && body.headers['Content-Type'] === 'application/octet-stream' && body.body) {
            body.body = Buffer.from(body.body, 'base64')
        }
        body.agent = agent
        /** @type {import('node-fetch').Response}*/
        const result = await fetch(url, body)
        const data = await result.arrayBuffer()
        const content = Buffer.from(data).toString('base64')
        const headers = fromEntries(result.headers)
        console.info('  forwardRequest', body.method || 'get', url, result.status)
        message.respond({
            status: result.status,
            statusText: result.statusText,
            headers: headers,
            content,
            resUrl: result.url
        })
    } catch (error) {
        errorHandler(message, error, '  forwardRequest', url, body)
    }
})

module.exports = {
    webosService: service
}
