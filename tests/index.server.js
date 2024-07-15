
const express = require('express')
const app = express()

app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use((req, res, next) => {
    const contentType = req.headers['content-type']

    if (contentType === 'text/plain') {
        express.text({ type: '*/*' })(req, res, next)
    } else if (contentType === 'application/json') {
        express.json()(req, res, next)
    } else if (contentType === 'application/octet-stream') {
        // Middleware personalizado para manejar application/octet-stream
        let rawData = ''
        req.setEncoding('binary')
        req.on('data', (chunk) => {
            rawData += chunk
        })
        req.on('end', () => {
            req.rawBody = rawData
            next()
        })
    } else {
        // Si el tipo de contenido no está soportado, puedes manejarlo aquí
        res.status(415).send('Unsupported Media Type')
    }
})

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const simple = (req, res) => {
    const status = req.query.status || 200
    res.status(parseInt(status)).send(req.query.body || 'simple')
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const body = (req, res) => {
    const status = req.query.status || 200
    res.status(parseInt(status)).json(req.body)
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const raw = (req, res) => {
    const status = req.query.status || 200
    res.status(parseInt(status)).send(req.rawBody)
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const stream = (req, res) => {
    const responseData = req.query.body
    const dataLength = Buffer.byteLength(responseData, 'utf8')

    res.setHeader('Content-Length', dataLength)
    responseData.split('').forEach((char, index) => {
        setTimeout(() => { res.write(char) }, 10 + index)
    })
    setTimeout(() => { res.end() }, responseData.length + 11)
}


app.get('/simple', simple)
app.delete('/simple', simple)
app.post('/simple', simple)
app.put('/simple', simple)
app.patch('/simple', simple)

app.post('/body', body)
app.put('/body', body)
app.patch('/body', body)

app.post('/raw', raw)
app.put('/raw', raw)
app.patch('/raw', raw)

app.get('/stream', stream)
app.delete('/stream', stream)
app.post('/stream', stream)
app.put('/stream', stream)
app.patch('/stream', stream)

module.exports = app
