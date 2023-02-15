import express from 'express'
import path from 'path'
import { InitType } from './db/enums/InitType'
import { authOrm, authRouter } from './features/auth'
import { bindAutoToolServer } from './features/autoTool'
import { calendarRouter } from './features/calendar'
import { repertoireOrm, repertoireRouter } from './features/repertoire'
import { TApp } from './types/TApp'

const { Server } = require('socket.io')

/**
 * Setup
 */
const PORT = 5555

const app: TApp = express()

/**
 * Middle ware
 */
const cors = require('cors')

app.use(cors())

const bodyParser = require('body-parser')

app.use(bodyParser.json({ limit: '1mb', extended: true }))
app.use(bodyParser.urlencoded({ limit: '1mb', extended: true }))

/**
 * Routes
 */
app.use('/auth', authRouter(app))
app.use('/calendar', calendarRouter())
app.use('/repertoire', repertoireRouter(app))

app.use(express.static(path.resolve('static')))

/**
 * Init
 */
Promise.all([
    authOrm.sync(InitType.UPDATE),
    repertoireOrm.sync(InitType.UPDATE),
])
    .then(() => {
        const server = app.listen(PORT, () => console.log(`Listening on port ${PORT}.`))

        const io = new Server(server, {
                cors: {
                    origin: '*',
                    methods: [ 'GET', 'POST' ],
                },
            },
        )

        io.on('connection', (socket) => {
            console.log('a user connected')
        })



        bindAutoToolServer(PORT, io)
    })
    .catch(err => {
        console.error('Cannot connect to database.', err)
    })
