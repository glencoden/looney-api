import { Optional } from 'sequelize'
import { TSong } from './TSong'

export type TSetlist = {
    id: number
    toolKey?: string
    title: string
    songs: TSong['id'][]
    songsByToolKeyId: string[]
    published: boolean
}

export type TSetlistCreationAttributes = Optional<TSetlist, 'id' | 'toolKey'>