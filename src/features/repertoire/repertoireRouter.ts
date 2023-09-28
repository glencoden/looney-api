import express from 'express'
import { TApp } from '../../types/TApp'
import { repertoireOrm } from './index'


export function repertoireRouter(app: TApp) {
    const router = express.Router()

    // songs

    router.route('/songs/:id?')
        .get(async (req, res) => {
            if (!req.params.id) {
                const songs = await repertoireOrm.getAllSongs()

                res.json({
                    data: songs,
                })
                return
            }

            const song = await repertoireOrm.getSong(parseInt(`${req.params.id}`))

            res.json({
                data: song,
            })
        })

    // setlist

    router.route('/setlist')
        .get(async (req, res) => {
            const setlistId = parseInt(`${req.query.id}`)
            const setlists = Number.isNaN(setlistId)
                ? await repertoireOrm.getAllSetlists()
                : await repertoireOrm.getSetlist(setlistId)
            res.json({
                data: setlists,
            })
        })

    // published setlist for website

    router.route('/published')
        .get(async (_req, res) => {
            const publishedSetlist = await repertoireOrm.getPublishedSetlist()
            res.json({
                data: publishedSetlist, // can be null
            })
        })
        .put(async (req, res) => {
            const result = await repertoireOrm.setPublishedSetlist(parseInt(req.body.id))
            res.json(result)
        })

    // all setlists and songs

    router.route('/backup')
        .get(async (_req, res) => {
            const backup = await repertoireOrm.getBackup()
            res.json({
                data: backup,
            })
        })
        .post(app.oauth.authorise(), async (req, res) => {
            const result = await repertoireOrm.setBackup(req.body)
            res.json(result)
        })

    return router
}
