
const logger = require('./logger')
const fetch = require('node-fetch')


logger.info('init service')

/** @type {import('webos-service').default} */
let service = null

try {
    const Service = require('webos-service')
    service = new Service('com.crunchyroll.webos.forwarding.service')
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


service.register('forwardRequest', async message => {
    try {
        const { config } = message.payload
        const { url } = config
        delete config.url
        /** @type {import('node-fetch').Response}*/
        const res = await fetch(url, config)
        const text = await res.text()
        message.respond({
            status: res.status,
            statusText: res.statusText,
            type: res.headers.get('Content-Type'),
            contet: text,
        })
    } catch (error) {
        errorHandler(message, error, 'startSsdp')
    }
})

module.exports = {
    webosService: service
}
