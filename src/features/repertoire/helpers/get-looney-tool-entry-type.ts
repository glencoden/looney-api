import { LooneyToolEntryType } from '../enums/LooneyToolEntryType'

export const getLooneyToolEntryType = (key: string | undefined): LooneyToolEntryType => {
    if (typeof key !== 'string') {
        return LooneyToolEntryType.NONE
    }
    const [, typePartial] = key.split('.')

    switch (typePartial) {
        case 'setlist':
            return LooneyToolEntryType.SETLIST
        case 'song':
            return LooneyToolEntryType.SONG
        default:
            return LooneyToolEntryType.NONE
    }
}