import { Model, ModelStatic } from 'sequelize'
import SequelizeOrm from '../../db/SequelizeOrm'
import { TSequelizeOrmProps } from '../../db/types/TSequelizeOrmProps'
import { TJson } from '../../types/TJson'
import { LooneyToolEntryType } from './enums/LooneyToolEntryType'
import { createBackupFromDbEntryList } from './helpers/create-backup-from-db-entry-list'
import { getLooneyToolEntryType } from './helpers/get-looney-tool-entry-type'
import setlistModel from './models/setlist'
import songModel from './models/song'

type TSetBackupResult = {
    success: boolean
    error: any
}


class RepertoireOrm extends SequelizeOrm {
    Setlist: ModelStatic<Model>
    Song: ModelStatic<Model>

    constructor(props: TSequelizeOrmProps) {
        super(props)

        this.Setlist = this.sequelize.define('Setlist', setlistModel)
        this.Song = this.sequelize.define('Song', songModel)
    }

    // route: backup

    getBackup(): Promise<Partial<Model>[]> {
        return Promise.all([
            this.Setlist.findAll(),
            this.Song.findAll(),
        ]).then((entryLists: Model[][]) => {
            const flatList = entryLists.reduce((result: Model[], currentList: Model[]) => [ ...result, ...currentList ], [])
            return createBackupFromDbEntryList(flatList)
        })
    }

    setBackup(payload: TJson): Promise<TSetBackupResult> {
        const entryList = JSON.parse(payload?.data)

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

                    let dbRequest: Promise<Model<any, any> | null | void> = Promise.resolve()

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
                                    return this.Setlist.create({
                                        toolKey: entry.key,
                                        title: entry.value?.title,
                                        songs: entry.value?.songs,
                                    })
                                        .then(resolve)
                                }
                                case LooneyToolEntryType.SONG: {
                                    if (typeof entry.value?.title !== 'string') {
                                        reject()
                                        return
                                    }
                                    return this.Song.create({
                                        toolKey: entry.key,
                                        title: entry.value?.title,
                                        lyrics: entry.value?.lyrics,
                                    })
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
                                return this.Setlist.update({
                                    toolKey: entry.key,
                                    title: entry.value?.title,
                                    songs: entry.value?.songs,
                                }, {
                                    where: { toolKey: entry.key },
                                })
                                    .then(resolve)
                            }
                            case LooneyToolEntryType.SONG: {
                                if (typeof entry.value?.title !== 'string') {
                                    reject()
                                    return
                                }
                                return this.Song.update({
                                    toolKey: entry.key,
                                    title: entry.value?.title,
                                    lyrics: entry.value?.lyrics,
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