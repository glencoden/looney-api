import { Optional } from 'sequelize'

export type TSongAttributes = {
    id: number
    toolKey?: string
    title: string
    lyrics: string
    special: boolean
}

export type TSongCreationAttributes = Optional<TSongAttributes, 'id' | 'toolKey'>