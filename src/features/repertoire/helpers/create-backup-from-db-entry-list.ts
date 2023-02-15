import { TJson } from '../../../types/TJson'
import { LooneyToolEntryType } from '../enums/LooneyToolEntryType'
import { getLooneyToolEntryType } from './get-looney-tool-entry-type'
import { getLooneyToolId } from './get-looney-tool-id'

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
                            songs: entry.songs,
                        },
                    }
                case LooneyToolEntryType.SONG:
                    return {
                        key: entry.toolKey,
                        value: {
                            id: getLooneyToolId(entry.toolKey),
                            title: entry.title,
                            lyrics: entry.lyrics,
                        },
                    }
                case LooneyToolEntryType.NONE:
                    return null
            }
        })
        .filter((e: TJson | null): e is TJson => e !== null) as TJson[]
}