import { Model } from 'sequelize'
import { TJson } from '../../../types/TJson'
import { LooneyToolEntryType } from '../enums/LooneyToolEntryType'
import { getLooneyToolEntryType } from './get-looney-tool-entry-type'
import { getLooneyToolId } from './get-looney-tool-id'

export const createBackupFromDbEntryList = (list: Model[]): TJson[] => {
    return list
        .map((entry: Model) => {
            // @ts-ignore
            const currentEntryType = getLooneyToolEntryType(entry.toolKey)

            switch (currentEntryType) {
                case LooneyToolEntryType.SETLIST:
                    return {
                        // @ts-ignore
                        key: entry.toolKey,
                        value: {
                            // @ts-ignore
                            id: getLooneyToolId(entry.toolKey),
                            // @ts-ignore
                            title: entry.title,
                            // @ts-ignore
                            songs: entry.songs,
                        },
                    }
                case LooneyToolEntryType.SONG:
                    return {
                        // @ts-ignore
                        key: entry.toolKey,
                        value: {
                            // @ts-ignore
                            id: getLooneyToolId(entry.toolKey),
                            // @ts-ignore
                            title: entry.title,
                            // @ts-ignore
                            lyrics: entry.lyrics,
                        },
                    }
                case LooneyToolEntryType.NONE:
                    return null
            }
        })
        .filter((e: TJson | null): e is TJson => e !== null) as TJson[]
}