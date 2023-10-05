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

const MAX_REQUESTS_PER_GUEST_PER_MINUTE = 5
const ACTIVE_SESSION_POLL_INTERVAL = 1000 * 60

let pollActiveSessionTimeoutId: NodeJS.Timeout | null = null

export function liveRouter(app: TApp, socketServer: Promise<Server>) {
    app.locals.session = null // session, lips and guests

    app.locals.lipsPerIP = null // [ip]: date[] | null

    app.locals.autoToolServerIP = null

    app.locals.sockets = []
    app.locals.bossSocket = null
    app.locals.toolSocket = null
    app.locals.guestSockets = []

    const router = express.Router()

    //
    //
    // SESSION ROUTES
    //
    //

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

            if (req.body.id === app.locals.session?.id) {
                deleteActiveSession() // which will be set by polling within the next interval and so be updated on all clients
            }

            res.json({
                data: result,
                error: null,
            })
        })
        .delete('/sessions/:session_id', app.oauth.authorise(), async (req, res) => {
            const result = await liveOrm.deleteSession(parseInt(req.params.session_id))

            if (req.params.session_id == app.locals.session?.id) {
                deleteActiveSession()
            }

            res.json({
                data: result,
                error: null,
            })
        })

    //
    //
    // LIP ROUTES
    //
    //

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

            const lips = await liveOrm.getLip(parseInt(req.params.lip_id))

            res.json({
                data: lips,
                error: null,
            })
        })
        .post('/lips', app.oauth.authorise(), async (_req, res) => {
            // For this route to make sense, boss would have to be able to create a lip for a guest, using its guid
            // Add lip to current active session

            res.send('Not implemented.')
        })
        .put('/lips', app.oauth.authorise(), async (req, res) => {
            await liveOrm.setLip(req.body)

            const lips = await liveOrm.getLip(req.body.id)

            if (app.locals.session !== null) {
                app.locals.session.lips = app.locals.session.lips.map((lip: TLip) => {
                    if (lip.id === lips[0].id) {
                        return lips[0]
                    }
                    return lip
                })
            }

            res.json({
                data: lips[0],
                error: null,
            })

            const socket = app.locals.guestSockets.find((s: GuestSocket) => s.guid === lips[0].guestGuid)

            if (socket) {
                socket.emit(SocketEvents.SERVER_GUEST_UPDATE_LIP, lips[0])
            }
        })
        .delete('/lips/:lip_id', app.oauth.authorise(), async (req, res) => {
            const [ , message ] = decodeURI(req.query.message as string).split('=')

            await liveOrm.setLip({
                id: parseInt(req.params.lip_id),
                status: LipStatus.DELETED,
                message,
            })

            const lips = await liveOrm.getLip(parseInt(req.params.lip_id))

            if (app.locals.session !== null) {
                app.locals.session.lips = app.locals.session.lips.map((lip: TLip) => {
                    if (lip.id === lips[0].id) {
                        return lips[0]
                    }
                    return lip
                })
            }

            res.json({
                data: lips[0],
                error: null,
            })

            const socket = app.locals.guestSockets.find((s: GuestSocket) => s.guid === lips[0].guestGuid)

            if (socket) {
                socket.emit(SocketEvents.SERVER_GUEST_UPDATE_LIP, lips[0])
            }
        })

    //
    //
    // GUEST ROUTES
    //
    //

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

                if (app.locals.lipsPerIP[ip].length > MAX_REQUESTS_PER_GUEST_PER_MINUTE) {
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

            app.locals.session.lips.push(result)

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

            app.locals.session.lips = app.locals.session.lips.map((prevLip: TLip) => {
                if (prevLip.id === lip.id) {
                    return lip
                }
                return prevLip
            })

            res.json({
                data: lip,
                error: null,
            })

            if (app.locals.bossSocket !== null) {
                app.locals.bossSocket.emit(SocketEvents.SERVER_BOSS_REMOVE_LIP, lip)
            }
        })

    //
    //
    // UTIL ROUTES
    //
    //

    router
        .get('/qr_code', async (_req, res) => {
            const nextSession = await liveOrm.getNextSession()

            if (nextSession.length === 0) {
                res.send('No upcoming session.')
                return
            }

            // TODO
            // Generate QR code with session guid in url https://lips.looneytunez.de?session=ab435b6f-5a4a-4049-a5b4-b0da3e94a977
            // Once guest client app gets served via this url, extract the params there and request guest data from server

            // auto send mails with QR code to Fabi and Nikolai a while before a session starts

            res.send('There will be a QR code here.')
        })

    router
        .get('auto_ip', (_req, res) => {
            res.json({
                data: app.locals.autoToolServerIP,
                error: null,
            })
        })
        .post('auto_tool_server_ip', (req, res) => {
            app.locals.autoToolServerIP = req.body.ip

            res.json({
                data: app.locals.autoToolServerIP,
                error: null,
            })

            if (app.locals.toolSocket !== null) {
                app.locals.toolSocket.emit(SocketEvents.SERVER_TOOL_CONNECT_AUTO, app.locals.autoToolServerIP)
            }
        })

    router
        .get('/insights/:session_id?', app.oauth.authorise(), (_req, res) => {
            res.send('There will be some insights here.')
        })

    //
    //
    // SOCKETS
    //
    //

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

            socket.on(SocketEvents.BOSS_SERVER_JOIN, (_, setSession) => {
                const index = app.locals.sockets.findIndex((s: Socket) => s.id === socket.id)

                if (index === -1) {
                    console.error('boss socket not found')
                    setSession(null)
                    return
                }

                app.locals.bossSocket = app.locals.sockets[index]

                app.locals.sockets.splice(index, 1)

                setSession(app.locals.session)
            })

            socket.on(SocketEvents.BOSS_SERVER_RUN_SESSION, () => {
                if (app.locals.session === null) {
                    return
                }

                app.locals.session.isRunning = true

                // TODO: emit to tool
            })

            socket.on(SocketEvents.BOSS_SERVER_PAUSE_SESSION, () => {
                if (app.locals.session === null) {
                    return
                }

                app.locals.session.isRunning = false

                // TODO: emit to tool
            })

            socket.on(SocketEvents.TOOL_SERVER_JOIN, () => {
                const index = app.locals.sockets.findIndex((s: Socket) => s.id === socket.id)

                if (index === -1) {
                    return
                }

                app.locals.toolSocket = app.locals.sockets[index]

                app.locals.sockets.splice(index, 1)

                // TODO: return status of session to tool
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

    //
    //
    // ACTIVE SESSION POLL
    //
    //

    if (pollActiveSessionTimeoutId !== null) {
        clearTimeout(pollActiveSessionTimeoutId)
    }

    const pollActiveSession = async () => {
        const sessions = await liveOrm.getActiveSession()

        if (sessions.length === 0) {
            deleteActiveSession()
        } else if (app.locals.session?.id !== sessions[0].id) {
            const lips = await liveOrm.getLipsBySessionId(sessions[0].id)

            app.locals.session = {
                isRunning: false,

                id: sessions[0].id,
                guid: sessions[0].guid,
                setlistId: sessions[0].setlistId,
                startDate: sessions[0].startDate,
                endDate: sessions[0].endDate,
                title: sessions[0].title,

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

        console.log(JSON.stringify(app.locals.session)) // TODO: remove dev code

        pollActiveSessionTimeoutId = setTimeout(pollActiveSession, ACTIVE_SESSION_POLL_INTERVAL)
    }

    pollActiveSession()

    //
    //
    // HELPERS
    //
    //

    const deleteActiveSession = () => {
        app.locals.session = null

        if (app.locals.bossSocket !== null) {
            app.locals.bossSocket.emit(SocketEvents.SERVER_ALL_SESSION_END)
        }

        app.locals.guestSockets.forEach((socket: Socket) => {
            socket.emit(SocketEvents.SERVER_ALL_SESSION_END)
        })
    }

    return router
}