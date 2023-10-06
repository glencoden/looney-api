import { Optional } from 'sequelize'

export type TSession = {
    id: number
    guid: string
    setlistId: number
    startDate: Date
    endDate: Date
    title: string
    deleted: boolean
}

export type TSessionCreationAttributes = Optional<TSession, 'id'>