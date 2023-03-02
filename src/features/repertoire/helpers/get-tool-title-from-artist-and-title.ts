const DELIMITER = ' - '

const EXCEPTION_ARTIST_NAMES: { [key: string]: string } = {
    ['Red Hot Chili Peppers']: 'R.H.C.P.',
}

export const getToolTitleFromArtistAndTitle = (artist: string, title: string): string => {
    let artistName = EXCEPTION_ARTIST_NAMES[artist] ?? artist.toUpperCase()
    return `${artistName}${DELIMITER}${title}`
}