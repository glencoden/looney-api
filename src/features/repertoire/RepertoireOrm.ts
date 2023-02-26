import { Model, ModelDefined } from 'sequelize'
import SequelizeOrm from '../../db/SequelizeOrm'
import { TSequelizeOrmProps } from '../../db/types/TSequelizeOrmProps'
import { TJson } from '../../types/TJson'
import { LooneyToolEntryType } from './enums/LooneyToolEntryType'
import { createBackupFromDbEntryList } from './helpers/create-backup-from-db-entry-list'
import { createLooneyToolKey } from './helpers/create-looney-tool-key'
import { getArtistAndTitleFormToolTitle } from './helpers/get-artist-and-title-form-tool-title'
import { getLooneyToolEntryType } from './helpers/get-looney-tool-entry-type'
import setlistModel from './models/setlist'
import songModel from './models/song'
import { TSetlist, TSetlistCreationAttributes } from './types/TSetlist'
import { TSong, TSongCreationAttributes } from './types/TSong'

type TSetResult = {
    success: boolean
    error: any
}

class RepertoireOrm extends SequelizeOrm {
    Setlist: ModelDefined<TSetlist, TSetlistCreationAttributes>
    Song: ModelDefined<TSong, TSongCreationAttributes>

    constructor(props: TSequelizeOrmProps) {
        super(props)

        this.Setlist = this.sequelize.define('Setlist', setlistModel)
        this.Song = this.sequelize.define('Song', songModel)
    }

    // route: setlist

    getAllSetlists() {
        return this.Setlist.findAll()
    }

    getSetlist(id: TSetlist['id']) {
        return this.Setlist.findAll({ where: { id } })
    }

    // route: published

    getPublishedSetlist() {
        return this.Setlist.findOne({
            where: { published: true },
        })
            .then((setlist) => {
                if (setlist === null) {
                    return null
                }
                // @ts-ignore
                return Promise.all(setlist.songs.map((id: number) => {
                    return this.Song.findOne({ where: { id } })
                }))
                    .then((songs) => {
                        return {
                            // @ts-ignore
                            title: setlist.title,
                            // @ts-ignore
                            songs: songs.map((song) => ({
                                artist: song.artist,
                                title: song.title,
                                special: song.special,
                            })),
                        }
                    })
            })
    }

    setPublishedSetlist(id: TSetlist['id']): Promise<TSetResult> {
        return this.Setlist.findAll()
            .then((setlists) => Promise.all(
                setlists.map(
                    (setlist: Model<TSetlist, TSetlistCreationAttributes>) => {
                        return this.Setlist.update(
                            // @ts-ignore
                            { published: setlist.id === id }, { where: { id: setlist.id } },
                        )
                    },
                ),
            ))
            .then(() => ({
                success: true,
                error: null,
            }))
            .catch((error) => ({
                success: false,
                error,
            }))
    }

    // route: backup

    getBackup() {
        return Promise.all([
            this.Setlist.findAll(),
            this.Song.findAll(),
        ]).then((entryLists) => {
            // @ts-ignore
            const flatList = entryLists.reduce((result, currentList) => [ ...result, ...currentList ], [])
            return createBackupFromDbEntryList(flatList)
        })
    }

    setBackup(payload: TJson): Promise<TSetResult> {
        const entryList = payload?.data

        // sort setlists to the end
        entryList.sort((a: TJson, b: TJson) => {
            const entryTypeA = getLooneyToolEntryType(a.key)
            const entryTypeB = getLooneyToolEntryType(b.key)

            if (entryTypeA === LooneyToolEntryType.SETLIST && entryTypeB === LooneyToolEntryType.SONG) {
                return 1
            } else if (entryTypeA === LooneyToolEntryType.SONG && entryTypeB === LooneyToolEntryType.SETLIST) {
                return -1
            }
            return 0
        })

        if (!Array.isArray(entryList)) {
            return Promise.resolve({
                success: false,
                error: `unexpected entryList type: ${typeof entryList}`,
            })
        }

        return Promise.all(
            entryList.map((entry: TJson) => {
                return new Promise((resolve, reject) => {
                    const currentEntryType = getLooneyToolEntryType(entry.key)

                    let dbRequest: Promise<Model | null | void> = Promise.resolve()

                    switch (currentEntryType) {
                        case LooneyToolEntryType.SETLIST:
                            dbRequest = this.Setlist.findOne({
                                where: { toolKey: entry.key },
                            })
                            break
                        case LooneyToolEntryType.SONG:
                            dbRequest = this.Song.findOne({
                                where: { toolKey: entry.key },
                            })
                    }

                    // @ts-ignore
                    dbRequest.then((result) => {
                        if (typeof result === 'undefined') {
                            reject()
                            return
                        }

                        if (result === null) {
                            switch (currentEntryType) {
                                case LooneyToolEntryType.SETLIST: {
                                    if (typeof entry.value?.title !== 'string' || !Array.isArray(entry.value?.songs)) {
                                        reject()
                                        return
                                    }
                                    return Promise.all(entry.value.songs.map((toolKeyId: string) => {
                                        const toolKey = createLooneyToolKey(toolKeyId, LooneyToolEntryType.SONG)
                                        if (toolKey === null) {
                                            return Promise.resolve(null)
                                        }
                                        return this.Song.findOne({ where: { toolKey } })
                                    }))
                                        .then((songs) => {
                                            return this.Setlist.create({
                                                toolKey: entry.key,
                                                title: entry.value.title,
                                                songsByToolKeyId: entry.value.songs,
                                                songs: songs.filter(Boolean).map((song) => song.id),
                                                published: false,
                                            } as TSetlist)
                                        })
                                        .then(resolve)
                                }
                                case LooneyToolEntryType.SONG: {
                                    if (typeof entry.value?.title !== 'string') {
                                        reject()
                                        return
                                    }
                                    const { artist, title } = getArtistAndTitleFormToolTitle(entry.value.title)
                                    return this.Song.create({
                                        toolKey: entry.key,
                                        artist,
                                        title,
                                        lyrics: entry.value.lyrics,
                                        special: false,
                                    } as TSong)
                                        .then(resolve)
                                }
                            }
                        }

                        switch (currentEntryType) {
                            case LooneyToolEntryType.SETLIST: {
                                if (typeof entry.value?.title !== 'string' || !Array.isArray(entry.value?.songs)) {
                                    reject()
                                    return
                                }
                                return Promise.all(entry.value.songs.map((toolKeyId: string) => {
                                    const toolKey = createLooneyToolKey(toolKeyId, LooneyToolEntryType.SONG)
                                    if (toolKey === null) {
                                        return Promise.resolve(null)
                                    }
                                    return this.Song.findOne({ where: { toolKey } })
                                }))
                                    .then((songs) => {
                                        return this.Setlist.update({
                                            toolKey: entry.key,
                                            title: entry.value.title,
                                            songsByToolKeyId: entry.value.songs,
                                            songs: songs.filter(Boolean).map((song) => song.id),
                                        }, {
                                            where: { toolKey: entry.key },
                                        })
                                    })
                                    .then(resolve)
                            }
                            case LooneyToolEntryType.SONG: {
                                if (typeof entry.value?.title !== 'string') {
                                    reject()
                                    return
                                }
                                const { artist, title } = getArtistAndTitleFormToolTitle(entry.value.title)
                                return this.Song.update({
                                    toolKey: entry.key,
                                    artist,
                                    title,
                                    lyrics: entry.value.lyrics,
                                }, {
                                    where: { toolKey: entry.key },
                                })
                                    .then(resolve)
                            }
                        }
                    })
                })
            }),
        )
            .then(() => ({
                success: true,
                error: null,
            }))
            .catch((error) => ({
                success: false,
                error,
            }))
    }
}

export default RepertoireOrm