import { Optional } from 'sequelize'

export type TSetlist = {
    id: number
    toolKey?: string
    title: string
    songs: number[]
    songsByToolKeyId: string[]
    published: boolean
}

export type TSetlistCreationAttributes = Optional<TSetlist, 'id' | 'toolKey'>