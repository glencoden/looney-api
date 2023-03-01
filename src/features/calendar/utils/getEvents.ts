import 'dotenv'
import { google } from 'googleapis'
import { parseGoogleCalendarEvents } from '../helpers/parse-google-calendar-events'

const {
    GLEN_CALENDAR_PROJECT_NUMBER,
    GOOGLE_CALENDAR_ID,
    CALENDAR_SCOPES,
    GOOGLE_PRIVATE_KEY,
    GOOGLE_CLIENT_EMAIL,
} = process.env

const jwtClient = new google.auth.JWT(
    GOOGLE_CLIENT_EMAIL,
    undefined,
    GOOGLE_PRIVATE_KEY,
    CALENDAR_SCOPES,
)

console.log(GOOGLE_PRIVATE_KEY)

// @ts-ignore
const calendar = google.calendar({
    version: 'v3',
    project: GLEN_CALENDAR_PROJECT_NUMBER,
    auth: jwtClient,
})

export const getEvents = () => {
    return new Promise((resolve) => {
        calendar.events.list({
            calendarId: GOOGLE_CALENDAR_ID,
            timeMin: (new Date()).toISOString(),
            maxResults: 99,
            singleEvents: true,
            orderBy: 'startTime',
        }, (error, result) => {
            if (error) {
                resolve({
                    data: null,
                    error,
                })
                return
            }
            resolve({
                data: parseGoogleCalendarEvents(result),
                error: null,
            })
        })
    })
}