import express from 'express'
import path from 'path'
import { InitType } from './db/enums/InitType'
import { authOrm, authRouter } from './features/auth'
import { bindAutoToolServer } from './features/autoTool'
import { calendarRouter } from './features/calendar'
import { repertoireOrm, repertoireRouter } from './features/repertoire'
import { TApp } from './types/TApp'
import { Server } from 'socket.io'
import cors from 'cors'
import bodyParser from 'body-parser'

/**
 * Setup
 */

const PORT = 5555

const app: TApp = express()

/**
 * Middle ware
 */

app.use(cors())

app.use(bodyParser.json({ limit: '1mb' }))
app.use(bodyParser.urlencoded({ limit: '1mb', extended: true }))

/**
 * Routes
 */

app.use('/auth', authRouter(app))
app.use('/calendar', calendarRouter())
app.use('/repertoire', repertoireRouter(app))

app.use(express.static(path.resolve('static')))

/**
 * Main
 */

const main = () => {
    const server = app.listen(PORT, () => console.log(`Listening on port ${PORT}.`))

    const io = new Server(server, {
            cors: {
                origin: '*',
                methods: [ 'GET', 'POST' ],
            },
        },
    )

    io.on('connection', (
        // socket
    ) => {
        console.log('a user connected')
    })

    bindAutoToolServer(io)
}

/**
 * Init
 */

Promise.all([
    authOrm.sync(InitType.UPDATE),
    repertoireOrm.sync(InitType.UPDATE),
])
    .then(main)
    .catch(console.error)
