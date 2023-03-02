const DELIMITER = '-'

const EXCEPTION_ARTIST_NAMES = {
    ['AC/DC']: 'AC/DC',
    ['KISS']: 'KISS',
    ['R.E.M.']: 'R.E.M.',
    ['ABBA']: 'ABBA',
    ['ZZ Top']: 'ZZ Top',
    ['A-HA']: 'A-HA',
    ['B-52s']: 'B-52s',
    ['TOTO']: 'TOTO',
    ['H.I.M.']: 'H.I.M.',
    ['U2']: 'U2',
    ['Guns n\' Roses']: 'Guns n\' Roses',
    ['Guns n\'Roses']: 'Guns n\' Roses',
}

const capitalFirstLetter = (input: string): string => {
    let result = ''
    for (let i = 0; i < input.length; i++) {
        if (i === 0) {
            result += input[i].toUpperCase()
        } else {
            result += input[i].toLowerCase()
        }
    }
    return result
}

const parseTitlePartial = (input: string): string => {
    const result = input.trim()
    const exceptions = Object.entries(EXCEPTION_ARTIST_NAMES)
    for (let i = 0; i < exceptions.length; i++) {
        const [key, value] = exceptions[i]
        if (key.toLowerCase() === result.toLowerCase()) {
            return value
        }
    }
    return result.replace(/[^\s\.,\/]+/g, capitalFirstLetter)
}

export const getArtistAndTitleFromToolTitle = (toolTitle: string): { artist: string, title: string } => {
    const [ artistPart, titlePart ] = toolTitle.split(DELIMITER)

    return {
        artist: parseTitlePartial(artistPart ?? ''),
        title: parseTitlePartial(titlePart ?? ''),
    }
}