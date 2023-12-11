import crypto from 'crypto'
import express from 'express'
import QRCode from 'qrcode'
import { Server, Socket } from 'socket.io'
import { TApp } from '../../types/TApp'
import { repertoireOrm } from '../repertoire'
import { LipStatus } from './enums/LipStatus'
import { ServerErrors } from './enums/ServerErrors'
import { SocketEvents } from './enums/SocketEvents'
import { liveOrm } from './index'
import { TLip } from './types/TLip'
import { TSession } from './types/TSession'

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
                const result = await liveOrm.getAllSessions()

                res.json({
                    data: result,
                    error: null,
                })
                return
            }

            const result = await liveOrm.getSession(parseInt(req.params.session_id))

            res.json({
                data: result[0],
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
                deleteActiveSession() // which will be reset by polling within the next interval and so be updated on all clients
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
        // Request /lips/0 to get all lips at all times
        .get('/lips/:session_id?/:lip_id?', async (req, res) => {
            if (!req.params.lip_id) {
                const sessionId = req.params.session_id ?? app.locals.session?.id ?? null

                const lips = sessionId !== null && sessionId !== 0
                    ? await liveOrm.getLipsBySessionId(sessionId)
                    : await liveOrm.getAllLips()

                res.json({
                    data: {
                        sessionId: sessionId,
                        lips,
                    },
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
            // req.body: TLipUpdate
            //
            // {
            //     id: number
            //     dragIndex: number
            //     dragStatus: LipStatus
            //     dropIndex: number
            //     dropStatus: LipStatus
            //     message: string
            // }

            if (app.locals.session === null) {
                res.json({
                    data: null,
                    error: ServerErrors.NO_ACTIVE_SESSION,
                })
                return
            }

            const dragIndex = req.body.dragIndex
            const dragStatus = req.body.dragStatus

            const dropIndex = req.body.dropIndex
            const dropStatus = req.body.dropStatus

            const prevLips = await liveOrm.getLipsBySessionId(app.locals.session.id)

            let updatedLip: TLip | null = null

            for (let i = 0; i < prevLips.length; i++) {
                const currentItem = prevLips[i]

                const currentIndex = currentItem.index
                const currentStatus = currentItem.status

                const isDragItem = currentItem.id === req.body.id

                if (isDragItem) {
                    let index = dropIndex

                    if (dropStatus === dragStatus && dragIndex < dropIndex) {
                        index--
                    }

                    updatedLip = {
                        ...currentItem,
                        index,
                        status: dropStatus,
                        message: req.body.message,
                    }

                    await liveOrm.setLip(updatedLip)

                    continue
                }

                let index = currentIndex

                if (currentStatus === dragStatus && currentIndex > dragIndex) {
                    index--
                }

                if (currentStatus === dropStatus && currentIndex >= dropIndex) {
                    index++
                }

                const message = req.body.message

                if (index === currentItem.index && message === currentItem.message) {
                    continue
                }

                await liveOrm.setLip({
                    ...currentItem,
                    index,
                    message,
                })
            }

            app.locals.session.lips = await liveOrm.getLipsBySessionId(app.locals.session.id)

            res.json({
                data: updatedLip,
                error: null,
            })

            const socket = app.locals.guestSockets.find((s: GuestSocket) => s.guid === updatedLip?.guestGuid)

            if (socket) {
                socket.emit(SocketEvents.SERVER_GUEST_UPDATE_LIP, updatedLip)
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

            const prevLips = await liveOrm.getLipsBySessionId(app.locals.session.id)

            const result = await liveOrm.createLip({
                sessionId: app.locals.session.id,
                songId: req.body.songId,
                guestGuid: req.params.guest_guid,
                guestName: req.body.name,
                status: LipStatus.IDLE,
                index: prevLips.filter((lip: TLip) => lip.status === LipStatus.IDLE).length, // this works cause new lips are idle
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
        .get('/qr_code/:session_id?', async (req, res) => {
            // TODO
            // 1. Auth protect route
            // 2. Enable QR code download for any session in boss.looneytunez.de
            // 3. Load QR code in looney tool default screen

            let sessionGuid: TSession['guid'] | null = null

            if (req.params.session_id) {
                const requestedSession = await liveOrm.getSession(parseInt(req.params.session_id))

                sessionGuid = requestedSession[0]?.guid ?? null
            } else {
                const nextSession = await liveOrm.getNextSession()

                sessionGuid = nextSession[0]?.guid ?? null
            }

            if (sessionGuid === null) {
                res.send('No session found.')
                return
            }

            const url = `https://lips.looneytunez.de?session=${sessionGuid}`

            QRCode.toDataURL(url, (err: unknown, data: string) => {
                if (err) {
                    res.send(err)
                    return
                }

                res.send(`<div style="height: 100vh; max-height: 800px; display: flex; justify-content: center; align-items: center;"><img src="${data}"></div>`)
            })
        })

    router
        .get('/auto_tool_server_ip', (_req, res) => {
            res.json({
                data: app.locals.autoToolServerIP,
                error: null,
            })
        })
        .post('/auto_tool_server_ip', (req, res) => {
            app.locals.autoToolServerIP = req.body.data?.ip // reading from looney-auto-tool-server axios request

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
            // TODO: implement functionality

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

            socket.on(SocketEvents.BOSS_SERVER_JOIN, (_, setSessionCallback) => {
                const index = app.locals.sockets.findIndex((s: Socket) => s.id === socket.id)

                if (index === -1) {
                    console.error('boss socket not found')
                    setSessionCallback(null)
                    return
                }

                app.locals.bossSocket = app.locals.sockets[index]

                app.locals.sockets.splice(index, 1)

                setSessionCallback(app.locals.session)
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
        const result = await liveOrm.getActiveSession()

        if (result.length === 0) {
            deleteActiveSession()
        } else if (app.locals.session?.id !== result[0].id) {
            const lips = await liveOrm.getLipsBySessionId(result[0].id)

            app.locals.session = {
                isRunning: false,

                id: result[0].id,
                guid: result[0].guid,
                setlistId: result[0].setlistId,
                startDate: result[0].startDate,
                endDate: result[0].endDate,
                title: result[0].title,

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