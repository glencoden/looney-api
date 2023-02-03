import express from 'express'
import { getShowDates } from './utils/getShowDates'


export function calendarRouter() {
    const router = express.Router()

    router.get('/', async (_req, res) => {
        const showDates = await getShowDates()
        console.log(showDates)
        res.json({
            showDates,
        })
    })

    return router
}