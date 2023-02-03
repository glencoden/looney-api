import 'dotenv'
import https from 'https'
import { URL, URLSearchParams } from 'url'

const CALENDAR_API_URL = 'https://www.googleapis.com/calendar/v3'

const { GOOGLE_API_KEY, CALENDAR_ID } = process.env

/**
 * Request service
 */
class RequestService {
    _get(url: string, search = {}) {
        console.log(`GET - ${url} - ${JSON.stringify(search)}`)

        const requestUrl = new URL(url)
        requestUrl.search = new URLSearchParams(search).toString()

        return new Promise((resolve, reject) => {
            https.get(requestUrl.toString(), resp => {
                let data = ''
                resp.on('data', (chunk) => {
                    data += chunk
                })
                resp.on('end', () => {
                    resolve(JSON.parse(data))
                })
            }).on('error', reject)
        })
    }

    getCalendars() {
        return this._get(`${CALENDAR_API_URL}/calendars/${CALENDAR_ID}`, { key: GOOGLE_API_KEY })
    }

    // _search(type, pageToken) {
    //     return this._get(
    //         `${CALENDAR_API_URL}/search`,
    //         {
    //             key: YOUTUBE_API_KEY,
    //             channelId: YOUTUBE_CHANNEL_ID,
    //             maxResults: GOOGLE_API_MAX_RESULTS,
    //             type,
    //             ...(pageToken ? { pageToken } : {}),
    //         },
    //     );
    // }
    //
    // searchVideos(pageToken) {
    //     return this._search('video', pageToken);
    // }
}

const requestService = new RequestService()

export const getShowDates = () => {
    return requestService.getCalendars()
}