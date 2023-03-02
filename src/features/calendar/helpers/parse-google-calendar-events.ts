import { TJson } from '../../../types/TJson'
import { TLiveEvent } from '../types/TLiveEvent'

const EVENT_IDENTIFIER = '@'

const HIDDEN_WORDS = [ 'confirmed', 'anfrage' ]

const HIDDEN_WORDS_REGEX = HIDDEN_WORDS.map((word: string) => {
    let matchString = ''
    for (let i = 0; i < word.length; i++) {
        matchString += `[${word[i].toLowerCase()}${word[i].toUpperCase()}]`
    }
    matchString += '[^a-zA-Z]?'
    return new RegExp(matchString, 'g')
})

const removeHiddenWords = (input: string): string => {
    let result = input
    for (let i = 0; i < HIDDEN_WORDS_REGEX.length; i++) {
        const currentWord = HIDDEN_WORDS_REGEX[i]
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