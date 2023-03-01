import { TJson } from '../../../types/TJson'
import { TLiveEvent } from '../types/TLiveEvent'

const EVENT_IDENTIFIER = '@'
const HIDDEN_WORDS = [ 'confirmed' ]

const removeHiddenWords = (input: string): string => {
    let result = input
    for (let i = 0; i < HIDDEN_WORDS.length; i++) {
        const currentWord = HIDDEN_WORDS[i]
        result = result.replace(currentWord, '')
    }
    return result.trim()
}

export const parseGoogleCalendarEvents = (response: TJson | null | undefined): TLiveEvent[] => {
    const result: TLiveEvent[] = []

    if (!Array.isArray(response?.data?.items)) {
        console.warn('unexpected google calendar events API result')
        return result
    }

    response!.data.items.forEach((item: TJson) => {
        if (typeof item?.summary !== 'string' || typeof item?.start?.dateTime !== 'string') {
            console.warn('unexpected google calendar event item', item)
            return
        }
        if (!item.summary.includes(EVENT_IDENTIFIER)) {
            return
        }
        const [ description, venue ] = item.summary.split(EVENT_IDENTIFIER)

        result.push({
            venue: removeHiddenWords(venue),
            description: removeHiddenWords(description),
            start: item.start.dateTime,
        })
    })

    return result
}