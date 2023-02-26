import { TJson } from '../../../types/TJson'
import { LooneyToolEntryType } from '../enums/LooneyToolEntryType'
import { getLooneyToolEntryType } from './get-looney-tool-entry-type'
import { getLooneyToolId } from './get-looney-tool-id'
import { getToolTitleFromArtistAndTitle } from './get-tool-title-from-artist-and-title'

export const createBackupFromDbEntryList = (list: any): TJson[] => {
    return list
        .map((entry: any) => {
            const currentEntryType = getLooneyToolEntryType(entry.toolKey)

            switch (currentEntryType) {
                case LooneyToolEntryType.SETLIST:
                    return {
                        key: entry.toolKey,
                        value: {
                            id: getLooneyToolId(entry.toolKey),
                            title: entry.title,
                            songs: entry.songsByToolKeyId,
                        },
                    }
                case LooneyToolEntryType.SONG:
                    return {
                        key: entry.toolKey,
                        value: {
                            id: getLooneyToolId(entry.toolKey),
                            title: getToolTitleFromArtistAndTitle(entry.artist, entry.title),
                            lyrics: entry.lyrics,
                        },
                    }
                case LooneyToolEntryType.NONE:
                    return null
            }
        })
        .filter((e: TJson | null): e is TJson => e !== null) as TJson[]
}