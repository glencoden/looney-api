import express from 'express'
import path from 'path'
import { InitType } from './db/enums/InitType'
import { authOrm, authRouter } from './features/auth'
import { calendarRouter } from './features/calendar'
import { repertoireOrm, repertoireRouter } from './features/repertoire'
import { TApp } from './types/TApp'

const PORT = process.env.PORT || 5555

const app: TApp = express()

const cors = require('cors')

app.use(cors())

const bodyParser = require('body-parser')

app.use(bodyParser.json({ limit: '1mb', extended: true }))
app.use(bodyParser.urlencoded({ limit: '1mb', extended: true }))


app.use('/auth', authRouter(app))
app.use('/calendar', calendarRouter())
app.use('/repertoire', repertoireRouter(app))


app.use(express.static(path.resolve('static')))


Promise.all([
    authOrm.sync(InitType.UPDATE),
    repertoireOrm.sync(InitType.UPDATE),
])
    .then(() => {
        app.listen(PORT, () => console.log(`Listening on port ${PORT}.`))
    })
    .catch(err => {
        console.error('cannot connect to database', err)
    })
