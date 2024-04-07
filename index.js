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
    let out = { returnValue: false }
    if (message.isSubscription) {
        out.id = message.payload.id
    }
    if (error instanceof Error) {
        out.error = `${error.name} - ${error.message}`
        out.stack = error.stack
    } else {
        out.error = JSON.stringify(error)
    }
    message.respond(out)
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

/**
 * Build a response
 * @param {import('node-fetch').Response} res
 * @param {ArrayBuffer} data
 * @param {String} log_name
 * @param {Object} extra
 * @returns {Object}
 */
function makeResponse(res, data, log_name, extra) {
    const content = Buffer.from(data).toString('base64')
    const headers = fromEntries(res.headers)
    console.info('  ', log_name, '  ', res.status)
    return {
        status: res.status,
        statusText: res.statusText,
        headers: headers,
        content,
        resUrl: res.url,
        ...extra
    }
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
        const res = await fetch(url, body)
        if (message.isSubscription) {
            const total = parseInt(res.headers.get('content-length'))
            const id = message.payload.id

            let loaded = 0
            let error
            res.body.on('error', err => { error = err })
            res.body.on('data', value => {
                loaded += value.length
                if (loaded === value.length) {
                    message.respond(makeResponse(res, value, log_name, { id, loaded, total }))
                } else {
                    const content = Buffer.from(value).toString('base64')
                    message.respond({ id, loaded, total, content, status: res.status })
                }

            })
            await new Promise((resolve, reject) => {
                res.body.on('close', () => {
                    if (error) {
                        reject(error)
                    } else {
                        resolve()
                    }
                })
            })
        } else {
            const data = await res.arrayBuffer()
            message.respond(makeResponse(res, data, log_name, {}))
        }
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
