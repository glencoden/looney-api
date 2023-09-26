import express from 'express'
import crypto from 'crypto'
import { Server, Socket } from 'socket.io'
import { TApp } from '../../types/TApp'
import { repertoireOrm } from '../repertoire'
import { LipStatus } from './enums/LipStatus'
import { liveOrm } from './index'
import { TLip } from './types/TLip'

const MAX_LIPS_PER_GUEST = 3

const DELETE_MESSAGES = [
    'Diesen Song haben wir heute Abend schon zu oft gehört. Damit der Abend abwechslungsreich bleibt, kommst du damit heute Abend nicht dran.',
    'Es gibt so viele Anmeldungen vor dir, dass wir es heute Abend leider nicht schaffen, dich mit diesem Song auf die Bühne zu holen.',
    'Da stimmt doch was nicht!',
]

// TODO: put the following on app.locals

let bossSocket: Socket | null = null

const guestSockets: Socket[] = []
const socketByGuid: { [guid: string]: Socket['id'] } = {}

export function liveRouter(app: TApp, socketServer: Promise<Server>) {
    app.locals.activeSession = null // session, lips and guests
    app.locals.lipsPerIP = {} // [sessionID][ip] = date[]

    const router = express.Router()

    router.route('/test')
        .get((req, res) => {
            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress

            res.json({
                headers: req.headers['x-forwarded-for'] || 'empty',
                socket: req.socket.remoteAddress || 'empty',
                ip,
            })
        })

    router
        .get('/protocol', app.oauth.authorise(), (_req, res) => {
            res.json(app.locals.lipsPerIP)
        })

    router
        .get('/guest/:guid?', async (req, res) => {
            if (app.locals.activeSession === null) {
                res.json({
                    success: false,
                    message: 'No active session.',
                })
                return
            }

            let guid = req.params.guid

            if (!guid || !app.locals.activeSession.guests.includes(guid)) {
                guid = crypto.randomUUID()

                app.locals.activeSession.guests.push(guid)
            }

            const setlist = await repertoireOrm.getSetlist(app.locals.activeSession.setlistId)
            const allSongs = await repertoireOrm.getAllSongs()
            // @ts-ignore
            const songs = setlist[0].songs.map((songId) => allSongs.find((song) => song.id === songId))

            const lips = await liveOrm.getLipsByGuestGuid(guid)

            const activeLips = lips.filter((lip: TLip) => lip.status === LipStatus.IDLE || lip.status === LipStatus.STAGED || lip.status === LipStatus.LIVE)

            res.json({
                success: true,
                data: {
                    sessionId: app.locals.activeSession.id, // always update on client
                    guid, // always update on client
                    songs,
                    lips: activeLips,
                },
            })
        })
        .post('/guest/:guid', async (req, res) => {
            // TODO: block IP if to many requests in too little time

            if (app.locals.activeSession === null) {
                res.json({
                    success: false,
                    message: 'No active session.',
                })
                return
            }

            const lips = await liveOrm.getLipsByGuestGuid(req.params.guid)

            const activeLips = lips.filter((lip: TLip) => lip.status === LipStatus.IDLE || lip.status === LipStatus.STAGED || lip.status === LipStatus.LIVE)

            if (activeLips.length >= MAX_LIPS_PER_GUEST) {
                res.json({
                    success: false,
                    message: `Max lips per guest limit of ${MAX_LIPS_PER_GUEST} reached.`,
                })
                return
            }

            const result = await liveOrm.setLip({
                sessionId: app.locals.activeSession.id,
                songId: req.body.songId,
                guestGuid: req.params.guid,
                date: new Date().toISOString(),
                name: req.body.name,
                status: LipStatus.IDLE,
            })

            res.json({
                success: true,
                data: result,
            })

            if (bossSocket !== null) {
                bossSocket.emit('new-lip', result)
            }
        })
        .delete('/guest/:guid/:lip_id', async (req, res) => {
            if (app.locals.activeSession === null) {
                res.json({
                    success: false,
                    message: 'No active session.',
                })
                return
            }

            const lips = await liveOrm.getLipsByGuestGuid(req.params.guid)

            if (lips.findIndex((lip: TLip) => lip.id === parseInt(req.params.lip_id)) === -1) {
                res.json({
                    success: false,
                    message: 'Lip to delete not found.',
                })
                return
            }

            const result = await liveOrm.deleteLip(parseInt(req.params.lip_id))

            res.json({
                success: true,
                data: result,
            })

            // WEBSOCKET emits update to boss
        })

    router
        .get('/lips/:lip_id?', app.oauth.authorise(), async (req, res) => {
            if (!req.params.lip_id) {
                const lips = await liveOrm.getAllLips()

                res.json({
                    data: lips,
                })
                return
            }

            const lip = await liveOrm.getLip(parseInt(req.params.lip_id))

            res.json({
                data: lip,
            })
        })
        .post('/lips', app.oauth.authorise(), async (req, res) => {
            // TODO: for this route to make sense, boss would have to be able to create a lip for a guest, using its guid

            const result = await liveOrm.setLip(req.body)

            res.json({
                data: result,
            })

            // WEBSOCKET emit update to guest
        })
        .put('lips', app.oauth.authorise(), async (req, res) => {
            const result = await liveOrm.setLip(req.body)

            res.json({
                data: result,
            })

            // @ts-ignore
            const socketId = socketByGuid[result.guestGuid]
            const socket = guestSockets.find((s) => s.id === socketId)

            if (socket) {
                socket.emit('update-lip', result)
            }
        })
        .delete('/lips/:lip_id/:message_index', app.oauth.authorise(), async (req, res) => {
            const result = await liveOrm.deleteLip(parseInt(req.params.lip_id))

            res.json({
                data: result,
            })

            // @ts-ignore
            const socketId = socketByGuid[result.guestGuid]
            const socket = guestSockets.find((s) => s.id === socketId)

            if (socket) {
                socket.emit('delete-lip', {
                    data: result,
                    message: DELETE_MESSAGES[Math.min(parseInt(req.params.message_index), DELETE_MESSAGES.length - 1)],
                })
            }
        })

    router
        .get('/sessions/:session_id?', app.oauth.authorise(), async (req, res) => {
            if (!req.params.session_id) {
                const sessions = await liveOrm.getAllSessions()

                res.json({
                    data: sessions,
                })
                return
            }

            const session = await liveOrm.getSession(parseInt(req.params.session_id))

            res.json({
                data: session,
            })
        })
        .get('/sessions/:session_id/start', app.oauth.authorise(), async (req, res) => {
            const session = await liveOrm.getSession(parseInt(req.params.session_id))
            const lips = await liveOrm.getLipsBySessionId(parseInt(req.params.session_id))

            app.locals.activeSession = {
                id: session[0].id,
                setlistId: session[0].setlistId,
                date: session[0].date,
                title: session[0].title,
                lips,
                guests: lips.reduce((result: string[], lip) => {
                    if (!result.includes(lip.guestGuid)) {
                        result.push(lip.guestGuid)
                    }
                    return result
                }, []),
            }

            res.json({
                data: app.locals.activeSession,
            })

            guestSockets.forEach((socket) => {
                socket.emit('start-session')
            })
        })
        .post('/sessions', app.oauth.authorise(), async (req, res) => {
            const result = await liveOrm.setSession(req.body)

            res.json({
                data: result,
            })
        })
        .put('/sessions', app.oauth.authorise(), async (req, res) => {
            const result = await liveOrm.setSession(req.body)

            res.json({
                data: result,
            })
        })
        .delete('/sessions/:session_id', app.oauth.authorise(), async (req, res) => {
            const result = await liveOrm.deleteSession(parseInt(req.params.session_id))

            res.json({
                data: result,
            })
        })

    socketServer.then((io) => {
        io.on('connection', (socket) => {
            socket.on('disconnect', () => {
                const index = guestSockets.findIndex((s) => s.id === socket.id)

                if (index !== -1) {
                    guestSockets.splice(index, 1)
                }
            })

            socket.on('join', (guid) => {
                socketByGuid[guid] = socket.id
            })

            socket.on('boss', () => {
                const index = guestSockets.findIndex((s) => s.id === socket.id)

                if (index !== -1) {
                    bossSocket = guestSockets[index]
                    guestSockets.splice(index, 1)

                    bossSocket.on('disconnect', () => {
                        app.locals.activeSession = null
                    })
                }
            })

            guestSockets.push(socket)
        })

        // Do websocket updates handle the activeSession data?

        // BOSS

        // delete active session >> emit delete event
        // update and delete lips
        // emit your-turn event
        // emit show this or that looneytool screen event

        // GUEST

        // add, update and delete lips
    })

    return router
}