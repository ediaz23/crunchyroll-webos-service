
require('core-js/stable/array/index')
var util = require('util');
var assert = require('assert');
var zlib = require('zlib')
var mainCode = require('../dist/src/index');

/** 
 * @typedef ServiceResponse
 * @type {Object}
 * @property {Number} status
 * @property {String} statusText
 * @property {Object} headers
 * @property {Object} content
 * @property {String} resUrl
 * @property {Number} id
 * @property {Number} loaded
 * @property {Number} total 
 */

/**
 * @typedef ServiceBody
 * @type {Object}
 * @property {String} url
 * @property {String} method
 * @property {Object} headers
 * @property {Object} body
 * @property {Number} id
 */

var url_base = 'http://localhost:3000'

var testQueue = [];
var isRunning = false;

function isPromise(obj) {
    return obj && typeof obj.then === 'function';
}

function xtest() { }

function test(description, fn) {
    testQueue.push({ description: description, fn: fn });
    if (!isRunning) {
        runNextTest();
    }
}

function runNextTest() {
    if (testQueue.length === 0) {
        isRunning = false;
        return;
    }

    isRunning = true;
    var el = testQueue.shift();
    var description = el.description, fn = el.fn

    function onError(err) {
        console.error('  **FAILED:', description);
        console.error('    ', err.message);
        if (err.stack) {
            console.log(err.stack);
        }
        console.log('END', description, '\n');
        runNextTest();
    }

    function onSuccess() {
        console.log('  PASSED:', description);
        console.log('END', description, '\n');
        runNextTest();
    }

    console.log('INIT', description);

    try {
        /** @type {Promise} */
        var result = fn();

        if (isPromise(result)) {
            result.then(onSuccess, onError)
        } else {
            onSuccess()
        }
    } catch (err) {
        onError(err)
    }
}

function expect(value) {
    return {
        toBeDefined: function() {
            assert.ok(value !== undefined && value !== null, 'Expected value to be defined but it was undefined or null');
        },
        toBe: function(expected) {
            assert.strictEqual(value, expected, 'Expected ' + value + ' to be ' + expected);
        },
        toEqual: function(expected) {
            assert.strictEqual(value, expected, 'Expected ' + value + ' to be ' + expected);
        }
    };
}


/**
 * @param {ServiceBody} body
 * @returns {Promise<ServiceResponse>}
 */

function makeRequest(body) {
    return new Promise(function(res, rej) {
        var data = {}, waiting = true
        if (body.id) {
            data[body.id] = []
        }
        var message = {
            respond: function(response) {
                if (waiting) {
                    if (body.id) {
                        data[body.id].push(response.content)
                        if (response.total === response.loaded) {
                            waiting = false
                            response.content = data[body.id]
                            delete data[body.id]
                            res(response)
                        }
                    } else {
                        waiting = false
                        if (response.returnValue === false) {
                            rej(response)
                        } else {
                            res(response)
                        }
                    }
                }
            },
            payload: { d: zlib.gzipSync(Buffer.from(JSON.stringify(body || {}), 'utf-8')).toString('base64') },
            id: body.id,
            isSubscription: body.isSubscription,
            uniqueToken: 'j' + Math.floor(1000 + Math.random() * 9000),
        }
        /** @type {Promise} */
        var prom = mainCode.webosService['forwardRequest0'](message)
        prom.catch(function(err) {
            if (waiting) {
                waiting = false
                rej(err)
            }
        })
    })
}
function runTest() {
    [200].forEach(function(status) {
        ['get', 'delete', 'post', 'put', 'patch'].forEach(function(method) {
            test(util.format('Simple %s %s', method, status), function() {
                var body = 'simple-' + method;
                return makeRequest({
                    url: util.format('%s/simple?status=%s&body=%s', url_base, status, body),
                    method: method,
                    headers: { 'Content-Type': 'text/plain' },
                }).then(function(responses) {
                    expect(responses.status).toBe(status);
                    expect(responses.content).toBeDefined();
                    const decodedString = zlib.gunzipSync(Buffer.from(responses.content, 'base64')).toString('utf-8')
                    expect(decodedString).toBe(body);
                })
            });

            test(util.format('Stream %s %s', method, status), function() {
                var body = 'stream-' + method;
                var id = 'k' + Math.floor(1000 + Math.random() * 9000);  // k is any letter
                return makeRequest({
                    url: util.format('%s/stream?status=%s&body=%s', url_base, status, body),
                    method: method,
                    headers: { 'Content-Type': 'text/plain' },
                    id: id,
                    isSubscription: true,
                }).then(function(responses) {
                    expect(responses.status).toBe(status);
                    expect(responses.id).toEqual(id);
                    expect(responses.content).toBeDefined();
                    expect(Array.isArray(responses.content)).toBe(true);
                    var decodedString = responses.content.map(function(c) {
                        return Buffer.from(c, 'base64').toString('utf-8');
                    }).join('');
                    expect(decodedString).toBe(body);
                })
            });

            if (['post', 'put', 'patch'].includes(method)) {
                test(util.format('body-json %s %s', method, status), function() {
                    var data = { body: 'testing' };
                    var body = JSON.stringify(data);
                    return makeRequest({
                        url: util.format('%s/body?status=%s', url_base, status),
                        method: method,
                        body: body,
                        headers: { 'Content-Type': 'application/json' },
                    }).then(function(responses) {
                        expect(responses.status).toBe(status);
                        expect(responses.content).toBeDefined();
                        var decodedString = zlib.gunzipSync(Buffer.from(responses.content, 'base64')).toString('utf-8');
                        expect(decodedString).toBe(body);
                    })
                });

                test(util.format('body-base64 %s %s', method, status), function() {
                    var data = JSON.stringify({ body: 'testing' });
                    return makeRequest({
                        url: util.format('%s/raw?status=%s', url_base, status),
                        method: method,
                        body: Buffer.from(data).toString('base64'),
                        headers: { 'Content-Type': 'application/octet-stream' },
                    }).then(function(responses) {
                        expect(responses.status).toBe(status);
                        expect(responses.content).toBeDefined();
                        var decodedString = zlib.gunzipSync(Buffer.from(responses.content, 'base64')).toString('utf-8');
                        expect(decodedString).toBe(data);
                    })
                });
            }
        });
    });
    return new Promise(function(resolve) {
        function checkQueue() {
            if (testQueue.length === 0 && !isRunning) {
                resolve();
            } else {
                setTimeout(checkQueue, 500);
            }
        }
        checkQueue();
    });
}

process.on('uncaughtException', function(err) {
    console.error('Excepción no capturada: ', err);
    console.error(err.stack || 'No hay stack disponible');
    process.exit(1);
});

process.on('unhandledRejection', function(reason, promise) {
    console.error('Rechazo de promesa no manejado:', reason);
    process.exit(1);
});

setTimeout(runTest, 0)
