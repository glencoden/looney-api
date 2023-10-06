import { Optional } from 'sequelize'
import { LipStatus } from '../enums/LipStatus'

export type TLip = {
    id: number
    sessionId: number
    songId: number
    guestGuid: string
    guestName: string
    status: LipStatus
    index: number
    deletedAt: Date | null
    liveAt: Date | null
    doneAt: Date | null
    message?: string
}

export type TLipCreationAttributes = Optional<TLip, 'id' | 'deletedAt' | 'liveAt' | 'doneAt'>