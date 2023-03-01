import express from 'express'
import { getEvents } from './utils/getEvents'


export function calendarRouter() {
    const router = express.Router()

    router.get('/events', async (_req, res) => {
        const response = await getEvents()
        res.json(response)
    })

    return router
}