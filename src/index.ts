import express from 'express'
import path from 'path'
import { InitType } from './db/enums/InitType'
import { authOrm, authRouter } from './features/auth'
import { calendarRouter } from './features/calendar'
import { liveOrm, liveRouter } from './features/live'
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

let resolveSocketServer: ((value: Server) => void) | null = null

const socketServer: Promise<Server> = new Promise((resolve) => {
    resolveSocketServer = resolve
})

/**
 * Middle ware
 */

app.use(cors())

app.use(bodyParser.json({ limit: '1mb' }))
app.use(bodyParser.urlencoded({ limit: '1mb', extended: true }))

/**
 * Main
 */

const main = () => {
    app.use('/auth', authRouter(app))
    app.use('/calendar', calendarRouter())
    app.use('/live', liveRouter(app, socketServer))
    app.use('/repertoire', repertoireRouter(app))

    app.use(express.static(path.resolve('static')))

    const server = app.listen(PORT, () => console.log(`Listening on port ${PORT}.`))

    const io = new Server(server, {
            cors: {
                origin: '*',
                methods: [ 'GET', 'POST' ],
            },
        },
    )

    resolveSocketServer!(io)
}

/**
 * Init
 */

Promise.all([
    authOrm.sync(InitType.UPDATE),
    liveOrm.sync(InitType.UPDATE),
    repertoireOrm.sync(InitType.UPDATE),
])
    .then(main)
    .catch(console.error)
