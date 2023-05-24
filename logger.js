
const LEVEL = process.env.LOG_LEVEL || 'info'
//const LEVEL = 'debug'

const formatObj = obj => {
    let extra = ''
    const keys = Object.keys(obj)
    if (keys.length) {
        if (keys.length === 2 && keys.includes('message') && keys.includes('stack')) {
            /** @type {Error} */
            const err = obj
            extra = `\n  message:${err.name}\n  stack:${err.stack}`
        } else {
            extra = '\n' + JSON.stringify(obj, null, '  ')
        }
    }
    return extra
}
/** @type {Function} */
let getMessage = null
const colors = { debug: '\x1b[34m', info: '\x1b[32m', error: '\x1b[31m' }
try {
    require('webos-service')
    getMessage = (message, level) => {
        if (!(typeof (message) === 'string' || message instanceof String)) {
            message = formatObj(message)
        }
        return `${colors[level]}${level.toUpperCase()}:\x1b[0m ${message}`
    }
} catch (_e) {
    getMessage = (message, level) => {
        if (!(typeof (message) === 'string' || message instanceof String)) {
            message = formatObj(message)
        }
        return `${Date.now()} ${colors[level]}${level.toUpperCase()}\x1b[0m ${message}`
    }
}
/**
   @type {{
    info: Function,
    error: Function,
    debug: Function,
}}
 */
const logger = {
    info: () => { },
    error: () => { },
    debug: () => { },
}

if (!console.debug) { console.debug = console.log }
if (!console.info) { console.info = console.log }
if (!console.error) { console.error = console.log }

/*eslint-disable */
switch (LEVEL) {
    case 'debug': logger.debug = msg => { console.debug(getMessage(msg, 'debug')) };
    case 'info': logger.info = msg => { console.info(getMessage(msg, 'info')) };
    case 'error': logger.error = msg => { console.error(getMessage(msg, 'error')) };
        break;
}
/*eslint-enable */


process.on('uncaughtException', err => {
    logger.error('uncaughtException')
    logger.error(err)
    if (err.stack) {
        logger.error(err.stack)
    }
    process.exit(1)
})

process.on('unhandledRejection', err => {
    logger.error('unhandledRejection')
    logger.error(err)
    if (err.stack) {
        logger.error(err.stack)
    }
    process.exit(1)
})

module.exports = logger
