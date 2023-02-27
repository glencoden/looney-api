const DELIMITER = '-'

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

const parseTitlePart = (input: string): string => {
    return input.replace(/[^\s\.,\/]+/g, capitalFirstLetter)
}

export const getArtistAndTitleFormToolTitle = (toolTitle: string): { artist: string, title: string } => {
    const [ artistPart, titlePart ] = toolTitle.split(DELIMITER)

    return {
        artist: parseTitlePart((artistPart ?? '').trim()),
        title: parseTitlePart((titlePart ?? '').trim()),
    }
}