import { Optional } from 'sequelize'

export type TSession = {
    id: number
    setlistId: number
    date: string
    title: string
    deleted: boolean
}

export type TSessionCreationAttributes = Optional<TSession, 'id'>