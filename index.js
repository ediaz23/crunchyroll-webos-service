"use strict";
/* jshint node: true */
const fetch = require('node-fetch')
const https = require('https')
const http = require('http')


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
const errorHandler = (message, error, name) => {
    if (error instanceof Error) {
        message.respond({ returnValue: false, error: `${error.name} - ${error.message}`, stack: error.stack })
    } else {
        message.respond({ returnValue: false, error: JSON.stringify(error) })
    }
    console.error(name, error)
}

/**
 * Fix for old node version
 * @param {import('node-fetch').Headers} headers
 * @returns {Object.<String, String>}
 */
function fromEntries(headers) {
    const result = {}
    headers.forEach((value, key) => {
        result[key] = value
    })
    return result
}

const agentHttps = new https.Agent({ rejectUnauthorized: false })
const agentHttp = new http.Agent({ rejectUnauthorized: false })

/**
 * @param {import('webos-service').Message} message
 * @returns {Promise}
 */
const forwardRequest = async message => {
    /** @type {{url: String}} */
    const { url } = message.payload
    delete message.payload.url
    /** @type {import('node-fetch').RequestInit}*/
    const body = message.payload
    const log_name = `${body.method || 'get'}  ${url.substring(0, 120)}`
    try {
        console.log(log_name)
        if (body.headers && body.headers['Content-Type'] === 'application/octet-stream' && body.body) {
            body.body = Buffer.from(body.body, 'base64')
        }
        body.agent = url.startsWith('http://') ? agentHttp : agentHttps
        /** @type {import('node-fetch').Response}*/
        const result = await fetch(url, body)
        const data = await result.arrayBuffer()
        const content = Buffer.from(data).toString('base64')
        const headers = fromEntries(result.headers)
        console.info('  ', log_name, '  ', result.status)
        message.respond({
            status: result.status,
            statusText: result.statusText,
            headers: headers,
            content,
            resUrl: result.url
        })
    } catch (error) {
        errorHandler(message, error, log_name)
    }
}

const CONCURRENT_REQ_LIMIT = 8

for (let concurrent = 0; concurrent < CONCURRENT_REQ_LIMIT; concurrent++) {
    service.register(`forwardRequest${concurrent}`, forwardRequest)
}

module.exports = {
    webosService: service
}
