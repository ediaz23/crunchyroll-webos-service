"use strict";
/* jshint node: true */
const fetch = require('node-fetch')
const https = require('https')
const http = require('http')
const zlib = require('zlib')

const log = (...args) => {
    // #if process.env.NODE_ENV === 'development'
    const error = new Error();
    /** @type {String} */
    let callerFile = error.stack.split('\n')[2]
    if (callerFile) {
        const regex = /\(([^)]+)\)/g
        let matches = [];
        let match;
        while ((match = regex.exec(callerFile)) !== null) {
            matches.push(match[1]);
        }
        if (matches.length > 0) {
            callerFile = '\n file://' + matches[0]
        }
    }
    console.info(...args, callerFile)
    // #endif
}


/** @type {import('webos-service').default} */
let service = null
const subscriptions = new Map();

try {
    const SERVICE_NAME = 'com.crunchyroll.stream.app.service'
    const Service = require('webos-service')
    service = new Service(SERVICE_NAME)
    log(SERVICE_NAME)
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
    let out = { returnValue: false, retry: false }

    if (message.isSubscription) {
        out.id = message.payload.id
    }
    if (error instanceof Error) {
        out.error = `${error.name} - ${error.message}`
        out.stack = error.stack
        out.retry = (
            error.type === 'request-timeout' ||
            error.name === 'AbortError' ||
            error.type === 'system' ||
            error.type === 'network'
        )
    } else {
        out.error = JSON.stringify(error)
    }
    message.respond(out)
    console.error('error', name, error)
    if (message.isSubscription) {
        message.cancel()
    }
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
 * @param {Boolean} compress
 * @param {Object} extra
 * @returns {Object}
 */
function makeResponse(res, data, log_name, compress, extra) {
    let content = null
    if (data.byteLength) {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
        if (compress) {
            content = zlib.gzipSync(buf).toString('base64')
        } else {
            content = buf.toString('base64')
        }
    }
    const headers = fromEntries(res.headers)
    log('res ', log_name, res.status, extra)
    return {
        status: res.status,
        statusText: res.statusText,
        headers: headers,
        content,
        resUrl: res.url,
        compress,
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
    const payload = JSON.parse(zlib.gunzipSync(Buffer.from(message.payload.d, 'base64')).toString('utf-8'))
    /** @type {{url: String}} */
    const { url } = payload
    delete payload.url
    /** @type {import('node-fetch').RequestInit}*/
    const body = payload
    const url_log = url.padEnd(200, ' ').substring(0, 200) + '.'
    const log_name = `${body.method || 'GET'} ${url_log} ${payload.id || ''}`.trim()
    try {
        log('init', log_name)
        if (body.headers && body.headers['Content-Type'] === 'application/octet-stream' && body.body) {
            body.body = Buffer.from(body.body, 'base64')
        }
        body.agent = url.startsWith('http://') ? agentHttp : agentHttps
        body.timeout = body.timeout || 20000
        /** @type {import('node-fetch').Response}*/
        const res = await fetch(url, body)
        if (message.isSubscription) {
            subscriptions.set(message.uniqueToken, message)
            const total = parseInt(res.headers.get('content-length'))
            const id = payload.id

            let loaded = 0
            let error
            res.body.on('error', err => { error = err })
            res.body.on('data', value => {
                if (subscriptions.get(message.uniqueToken)) {
                    loaded += value.length
                    if (loaded === value.length) {
                        message.respond(makeResponse(res, value, log_name, false, { id, loaded, total }))
                    } else {
                        const content = Buffer.from(value).toString('base64')
                        log('resT', log_name, res.status)
                        message.respond({ id, loaded, total, content, status: res.status })
                    }
                }
            })
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(`${log_name} timeout ${body.timeout}`)
                }, body.timeout)
                res.body.on('end', () => {
                    clearTimeout(timeout)
                    log('end ', log_name, res.status, error ? 'error' : 'okey')
                    if (error) {
                        reject(error)
                    } else {
                        resolve()
                    }
                })
            })
        } else {
            const data = await res.arrayBuffer()
            message.respond(makeResponse(res, data, log_name, true, {}))
        }
    } catch (error) {
        errorHandler(message, error, log_name)
    } finally {
        subscriptions.delete(message.uniqueToken)
    }
}

/**
 * @param {import('webos-service').Message} message
 * @returns {Promise}
 */
const cancelForwardRequest = message => {
    subscriptions.delete(message.uniqueToken)
}

const CONCURRENT_REQ_LIMIT = 10

for (let concurrent = 0; concurrent < CONCURRENT_REQ_LIMIT; concurrent++) {
    service.register(`forwardRequest${concurrent}`, forwardRequest, cancelForwardRequest)
}

/**
 * @param {import('webos-service').Message} message
 * @returns {Promise}
 */
const testFunciont = async message => {
    if (message.payload) {
        if (message.payload.type === 'simple') {
            message.respond({ status: 'okey' })
        } else if (message.payload.type === 'request') {
            await forwardRequest(message)
        } else {
            message.respond({ status: 'okey' })
        }
    } else {
        message.respond({ status: 'okey' })
    }
}

service.register('test', testFunciont)

module.exports = {
    webosService: service
}
