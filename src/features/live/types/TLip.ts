import { Optional } from 'sequelize'
import { LipStatus } from '../enums/LipStatus'

export type TLip = {
    id: number
    sessionId: number
    songId: number
    guestGuid: string
    date: string
    name: string
    status: LipStatus
    message?: string
    index?: number
}

export type TLipCreationAttributes = Optional<TLip, 'id'>