const DELIMITER = '-'

const EXCEPTION_ARTIST_NAMES = [ 'AC/DC', 'KISS', 'R.E.M.', 'ABBA', 'ZZ Top', 'A-HA', 'B-52s', 'TOTO', 'H.I.M.', 'U2', 'Guns n\' Roses' ]

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
    if (EXCEPTION_ARTIST_NAMES.includes(result)) {
        return result
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