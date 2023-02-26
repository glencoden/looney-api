import { Optional } from 'sequelize'

export type TSong = {
    id: number
    toolKey?: string
    artist: string
    title: string
    lyrics: string
    special: boolean
}

export type TSongCreationAttributes = Optional<TSong, 'id' | 'toolKey'>