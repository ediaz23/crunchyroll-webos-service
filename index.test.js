
const { webosService } = require('./index')
const app = require('./index.server')

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

const url_base = 'http://localhost:3000'
let server

beforeAll((done) => {
    server = app.listen(3000, () => {
        console.log('Test server running on port 3000')
        done()
    })
})

afterAll((done) => {
    server.close(() => {
        console.log('Test server closed')
        done()
    })
})


/**
 * @param {ServiceBody} body
 * @returns {Promise<ServiceResponse>}
 */
const makeRequest = async (body) => {
    return new Promise((res) => {
        let data = {}
        if (body.id) {
            data[body.id] = []
        }
        const message = {
            respond: response => {
                if (body.id) {
                    data[body.id].push(response.content)
                    if (response.total === response.loaded) {
                        response.content = data[body.id]
                        delete data[body.id]
                        res(response)
                    }
                } else {
                    res(response)
                }
            },
            payload: body || {},
            id: body.id,
            isSubscription: body.isSubscription,
        }
        webosService['forwardRequest0'](message)
    })
}

describe('Test request script', () => {
    describe.each([200])('status %s', status => {
        describe.each(['get', 'delete', 'post', 'put', 'patch'])('method %s', method => {
            test('simple', async () => {
                const body = 'simple-' + method
                const url = `${url_base}/simple?status=${status}&body=${body}`
                const headers = { 'Content-Type': 'text/plain' }
                const responses = await makeRequest({ url, method, headers })
                expect(responses.status).toBe(status)
                expect(responses.content).toBeDefined()
                const decodedString = Buffer.from(responses.content, 'base64').toString('utf-8')
                expect(decodedString).toBe(body)
            })
            test('stream', async () => {
                const body = 'stream-' + method
                const url = `${url_base}/stream?status=${status}&body=${body}`
                const headers = { 'Content-Type': 'text/plain' }
                const id = method
                const responses = await makeRequest({ url, method, headers, id, isSubscription: true })
                expect(responses.status).toBe(status)
                expect(responses.id).toEqual(id)
                expect(responses.content).toBeDefined()
                expect(Array.isArray(responses.content)).toBe(true)
                const decodedString = responses.content.map(c => Buffer.from(c, 'base64').toString('utf-8')).join('')
                expect(decodedString).toBe(body)
            })
            if (['post', 'put', 'patch'].includes(method)) {
                test('body-json', async () => {
                    const data = { body: 'testing' }
                    const body = JSON.stringify(data)
                    const url = `${url_base}/body?status=${status}`
                    const headers = { 'Content-Type': 'application/json' }
                    const responses = await makeRequest({ url, method, body, headers })
                    expect(responses.status).toBe(status)
                    expect(responses.content).toBeDefined()
                    const decodedString = Buffer.from(responses.content, 'base64').toString('utf-8')
                    expect(decodedString).toBe(body)
                })
                test('body-base64', async () => {
                    const data = JSON.stringify({ body: 'testing' })
                    const body = Buffer.from(data).toString('base64')
                    const url = `${url_base}/raw?status=${status}`
                    const headers = { 'Content-Type': 'application/octet-stream' }
                    const responses = await makeRequest({ url, method, body, headers })
                    expect(responses.status).toBe(status)
                    expect(responses.content).toBeDefined()
                    const decodedString = Buffer.from(responses.content, 'base64').toString('utf-8')
                    expect(decodedString).toBe(data)
                })
            }
        })
    })
})
