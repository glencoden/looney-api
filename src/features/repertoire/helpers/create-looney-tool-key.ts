import { LooneyToolEntryType } from '../enums/LooneyToolEntryType'

const TOOL_KEY_PREFIX = 'looneytoolz'


export const createLooneyToolKey = (toolKeyId: string, type: LooneyToolEntryType): string | null => {
    if (type === LooneyToolEntryType.NONE) {
        return null
    }
    return `${TOOL_KEY_PREFIX}.${type}.${toolKeyId}`
}