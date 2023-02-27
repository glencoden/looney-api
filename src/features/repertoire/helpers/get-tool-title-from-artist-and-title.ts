const DELIMITER = ' - '

export const getToolTitleFromArtistAndTitle = (artist: string, title: string): string => {
    return `${artist.toUpperCase()}${DELIMITER}${title}`
}