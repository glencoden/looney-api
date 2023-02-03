import express from 'express'
import { TApp } from '../../types/TApp'
import { repertoireOrm } from './index'


export function repertoireRouter(app: TApp) {
    const router = express.Router()

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
