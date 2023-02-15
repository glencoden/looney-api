import { Optional } from 'sequelize'

export type TSetlistAttributes = {
    id: number
    toolKey?: string
    title: string
    songs: string[]
    published: boolean
}

export type TSetlistCreationAttributes = Optional<TSetlistAttributes, 'id' | 'toolKey'>