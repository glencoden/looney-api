import crypto from 'crypto'
import express from 'express'
import { Server, Socket } from 'socket.io'
import { TApp } from '../../types/TApp'
import { repertoireOrm } from '../repertoire'
import { LipStatus } from './enums/LipStatus'
import { ServerErrors } from './enums/ServerErrors'
import { SocketEvents } from './enums/SocketEvents'
import { liveOrm } from './index'
import { TLip } from './types/TLip'

type GuestSocket = Socket & { guid: string }

const MAX_REQUESTS_PER_IP_PER_MINUTE = 5
const ACTIVE_SESSION_POLL_INTERVAL = 1000 * 60

let pollActiveSessionTimeoutId: NodeJS.Timeout | null = null

export function liveRouter(app: TApp, socketServer: Promise<Server>) {

    // poll active session

    if (pollActiveSessionTimeoutId !== null) {
        clearTimeout(pollActiveSessionTimeoutId)
    }

    const pollActiveSession = async () => {
        const session = await liveOrm.getActiveSession()

        if (session.length === 0) {
            app.locals.session = null

            if (app.locals.bossSocket !== null) {
                app.locals.bossSocket.emit(SocketEvents.SERVER_ALL_SESSION_END)
            }

            app.locals.guestSockets.forEach((socket: Socket) => {
                socket.emit(SocketEvents.SERVER_ALL_SESSION_END)
            })
        } else if (app.locals.session?.id !== session[0].id) {
            const lips = await liveOrm.getLipsBySessionId(session[0].id)

            app.locals.session = {
                id: session[0].id,
                guid: session[0].guid,
                setlistId: session[0].setlistId,
                startDate: session[0].startDate,
                endDate: session[0].endDate,
                title: session[0].title,

                isRunning: false,

                lips: lips.map((lip) => ({
                    id: lip.id,
                    sessionId: lip.sessionId,
                    songId: lip.songId,
                    guestGuid: lip.guestGuid,
                    guestName: lip.guestName,
                    deletedAt: lip.deletedAt,
                    liveAt: lip.liveAt,
                    doneAt: lip.doneAt,
                    status: lip.status,
                    message: lip.message,
                })),

                guests: lips.reduce((result: string[], lip) => {
                    if (!result.includes(lip.guestGuid)) {
                        result.push(lip.guestGuid)
                    }
                    return result
                }, []),
            }

            if (app.locals.bossSocket !== null) {
                app.locals.bossSocket.emit(SocketEvents.SERVER_ALL_SESSION_START)
            }

            app.locals.guestSockets.forEach((socket: Socket) => {
                socket.emit(SocketEvents.SERVER_ALL_SESSION_START)
            })
        }

        console.log(JSON.stringify(app.locals.session))

        pollActiveSessionTimeoutId = setTimeout(pollActiveSession, ACTIVE_SESSION_POLL_INTERVAL)
    }

    pollActiveSession()


    // safety

    app.locals.lipsPerIP = null // [ip]: date[] | null


    // sockets

    app.locals.sockets = []

    app.locals.bossSocket = null
    app.locals.toolSocket = null
    app.locals.guestSockets = []


    // session

    app.locals.session = null // session, lips and guests


    // routes

    const router = express.Router()

    router
        .get('/sessions/:session_id?', app.oauth.authorise(), async (req, res) => {
            if (!req.params.session_id) {
                const sessions = await liveOrm.getAllSessions()

                res.json({
                    data: sessions,
                    error: null,
                })
                return
            }

            const session = await liveOrm.getSession(parseInt(req.params.session_id))

            res.json({
                data: session,
                error: null,
            })
        })
        .post('/sessions', app.oauth.authorise(), async (req, res) => {
            const result = await liveOrm.createSession({
                ...req.body,
                guid: crypto.randomUUID(),
            })

            res.json({
                data: result,
                error: null,
            })
        })
        .put('/sessions', app.oauth.authorise(), async (req, res) => {
            const result = await liveOrm.setSession(req.body)

            res.json({
                data: result,
                error: null,
            })
        })
        .delete('/sessions/:session_id', app.oauth.authorise(), async (req, res) => {
            const result = await liveOrm.deleteSession(parseInt(req.params.session_id))

            res.json({
                data: result,
                error: null,
            })
        })

    router
        .get('/lips/:lip_id?', app.oauth.authorise(), async (req, res) => {
            if (!req.params.lip_id) {
                const lips = await liveOrm.getAllLips()

                res.json({
                    data: lips,
                    error: null,
                })
                return
            }

            const lip = await liveOrm.getLip(parseInt(req.params.lip_id))

            res.json({
                data: lip,
                error: null,
            })
        })
        .post('/lips', app.oauth.authorise(), async (_req, res) => {
            // For this route to make sense, boss would have to be able to create a lip for a guest, using its guid

            res.send('Not implemented.')
        })
        .put('/lips', app.oauth.authorise(), async (req, res) => {
            await liveOrm.setLip(req.body)

            const lip = await liveOrm.getLip(req.body.id)

            const socket = app.locals.guestSockets.find((s: GuestSocket) => s.guid === lip[0].guestGuid)

            if (socket) {
                socket.emit(SocketEvents.SERVER_GUEST_UPDATE_LIP, lip[0])
            }

            res.json({
                data: lip[0],
                error: null,
            })
        })
        .delete('/lips/:lip_id', app.oauth.authorise(), async (req, res) => {
            const [ , message ] = decodeURI(req.query.message as string).split('=')

            await liveOrm.setLip({
                id: parseInt(req.params.lip_id),
                status: LipStatus.DELETED,
                message,
            })

            const lip = await liveOrm.getLip(parseInt(req.params.lip_id))

            const socket = app.locals.guestSockets.find((s: GuestSocket) => s.guid === lip[0].guestGuid)

            if (socket) {
                socket.emit(SocketEvents.SERVER_GUEST_UPDATE_LIP, lip[0])
            }

            res.json({
                data: lip[0],
                error: null,
            })
        })

    router
        .get('/guest/:session_guid/:guest_guid?', async (req, res) => {
            if (app.locals.session === null) {
                res.json({
                    data: null,
                    error: ServerErrors.NO_ACTIVE_SESSION,
                })
                return
            }

            if (app.locals.session.guid !== req.params.session_guid) {
                res.json({
                    data: null,
                    error: ServerErrors.WRONG_SESSION_GUID,
                })
                return
            }

            let guid = req.params.guest_guid

            if (!guid || !app.locals.session.guests.includes(guid)) {
                guid = crypto.randomUUID()

                app.locals.session.guests.push(guid)
            }

            const setlist = await repertoireOrm.getSetlist(app.locals.session.setlistId)

            const allSongs = await repertoireOrm.getAllSongs()
            // @ts-ignore
            const songs = setlist[0].songs.map((songId) => allSongs.find((song) => song.id === songId))

            const lips = await liveOrm.getLipsByGuestGuid(guid)

            res.json({
                data: {
                    sessionId: app.locals.session.id, // always set response value on client
                    guid, // always set response value on client
                    songs,
                    lips,
                },
                error: null,
            })
        })
        .post('/guest/:session_guid/:guest_guid', async (req, res) => {
            if (app.locals.session === null) {
                res.json({
                    data: null,
                    error: ServerErrors.NO_ACTIVE_SESSION,
                })
                return
            }

            const rawIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress
            const ip = (Array.isArray(rawIP) ? rawIP[0] : rawIP) ?? 'unknown'

            if (app.locals.lipsPerIP === null) {
                app.locals.lipsPerIP = {
                    [ip]: [ new Date() ],
                }
            } else if (app.locals.lipsPerIP[ip] === undefined) {
                app.locals.lipsPerIP[ip] = [ new Date() ]
            } else {
                app.locals.lipsPerIP[ip].push(new Date())

                app.locals.lipsPerIP[ip] = app.locals.lipsPerIP[ip].filter((date: Date) => date.getTime() > new Date().getTime() - 1000 * 60)

                if (app.locals.lipsPerIP[ip].length > MAX_REQUESTS_PER_IP_PER_MINUTE) {
                    res.json({
                        data: null,
                        error: ServerErrors.TOO_MANY_REQUESTS,
                    })
                    return
                }
            }

            if (app.locals.session.guid !== req.params.session_guid) {
                res.json({
                    data: null,
                    error: ServerErrors.WRONG_SESSION_GUID,
                })
                return
            }

            if (app.locals.session.guests.includes(req.params.guest_guid)) {
                res.json({
                    data: null,
                    error: ServerErrors.WRONG_GUEST_GUID,
                })
                return
            }

            const result = await liveOrm.createLip({
                sessionId: app.locals.session.id,
                songId: req.body.songId,
                guestGuid: req.params.guest_guid,
                guestName: req.body.name,
                status: LipStatus.IDLE,
            })

            res.json({
                data: result,
                error: null,
            })

            if (app.locals.bossSocket !== null) {
                app.locals.bossSocket.emit(SocketEvents.SERVER_BOSS_ADD_LIP, result)
            }
        })
        .delete('/guest/:session_guid/:guest_guid/:lip_id', async (req, res) => {
            if (app.locals.session === null) {
                res.json({
                    data: null,
                    error: ServerErrors.NO_ACTIVE_SESSION,
                })
                return
            }

            if (app.locals.session.guid !== req.params.session_guid) {
                res.json({
                    data: null,
                    error: ServerErrors.WRONG_SESSION_GUID,
                })
                return
            }

            if (app.locals.session.guests.includes(req.params.guest_guid)) {
                res.json({
                    data: null,
                    error: ServerErrors.WRONG_GUEST_GUID,
                })
                return
            }

            const lips = await liveOrm.getLipsByGuestGuid(req.params.guest_guid)
            const lip = lips.find((lip: TLip) => lip.id === parseInt(req.params.lip_id))

            if (!lip) {
                res.json({
                    data: null,
                    error: ServerErrors.NOT_FOUND,
                })
                return
            }

            await liveOrm.setLip({
                id: parseInt(req.params.lip_id),
                status: LipStatus.DELETED,
                message: 'deleted by guest',
            })

            res.json({
                data: lip,
                error: null,
            })

            if (app.locals.bossSocket !== null) {
                app.locals.bossSocket.emit(SocketEvents.SERVER_BOSS_REMOVE_LIP, lip)
            }
        })

    router
        .get('/qr', async (_req, res) => {
            const nextSession = await liveOrm.getNextSession()

            if (nextSession.length === 0) {
                res.send('No upcoming session.')
                return
            }

            // TODO
            // Generate QR code with session guid in url https://lips.looneytunez.de?session=ab435b6f-5a4a-4049-a5b4-b0da3e94a977
            // Once guest client app gets served via this url, extract the params there and request guest data from server

            res.send('There will be a QR code here.')
        })

    router
        .get('/insights/:session_id?', app.oauth.authorise(), (_req, res) => {
            res.send('There will be some insights here.')
        })

    socketServer.then((io) => {
        io.on('connection', (socket) => {
            app.locals.sockets.push(socket)

            socket.on('disconnect', () => {
                if (app.locals.bossSocket !== null && app.locals.bossSocket.id === socket.id) {
                    app.locals.bossSocket = null
                    return
                }

                if (app.locals.toolSocket !== null && app.locals.toolSocket.id === socket.id) {
                    app.locals.toolSocket = null
                    return
                }

                const socketIndex = app.locals.sockets.findIndex((s: Socket) => s.id === socket.id)

                if (socketIndex !== -1) {
                    app.locals.sockets.splice(socketIndex, 1)
                    return
                }

                const guestSocketIndex = app.locals.guestSockets.findIndex((s: Socket) => s.id === socket.id)

                if (guestSocketIndex !== -1) {
                    app.locals.guestSockets.splice(guestSocketIndex, 1)
                    return
                }
            })

            socket.on(SocketEvents.BOSS_SERVER_JOIN, (_, setIsRunning) => {
                const index = app.locals.sockets.findIndex((s: Socket) => s.id === socket.id)

                if (index === -1) {
                    setIsRunning(false)
                    return
                }

                app.locals.bossSocket = app.locals.sockets[index]

                app.locals.sockets.splice(index, 1)

                setIsRunning(app.locals.session?.isRunning ?? false)
            })

            socket.on(SocketEvents.BOSS_SERVER_RUN_SESSION, () => {
                if (app.locals.session === null) {
                    return
                }

                app.locals.session.isRunning = true
            })

            socket.on(SocketEvents.BOSS_SERVER_PAUSE_SESSION, () => {
                if (app.locals.session === null) {
                    return
                }

                app.locals.session.isRunning = false
            })

            socket.on(SocketEvents.TOOL_SERVER_JOIN, () => {
                const index = app.locals.sockets.findIndex((s: Socket) => s.id === socket.id)

                if (index === -1) {
                    return
                }

                app.locals.toolSocket = app.locals.sockets[index]

                app.locals.sockets.splice(index, 1)
            })

            socket.on(SocketEvents.GUEST_SERVER_JOIN, (guid) => {
                const index = app.locals.sockets.findIndex((s: Socket) => s.id === socket.id)

                if (index === -1) {
                    return
                }

                app.locals.sockets.splice(index, 1)
                app.locals.guestSockets.push({
                    ...socket,
                    guid,
                })
            })
        })
    })

    return router
}