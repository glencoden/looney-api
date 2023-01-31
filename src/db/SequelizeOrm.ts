import { Sequelize } from 'sequelize'
import { InitType } from './enums/InitType'
import { TSequelizeOrmProps } from './types/TSequelizeOrmProps'

const initOptions = {
    [InitType.PERSIST]: {}, // creates the table if it doesn't exist (and does nothing if it already exists)
    [InitType.UPDATE]: { alter: true }, // checks what is the current state of the table in the database (which columns it has, what are their data types, etc), and then performs the necessary changes in the table to make it match the model
    [InitType.RESET]: { force: true }, // creates the table, dropping it first if it already existed
}

function waitFor(time: number = 1000): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, time))
}


class SequelizeOrm {
    sequelize: Sequelize

    constructor({ databaseUrl }: TSequelizeOrmProps) {
        this.sequelize = new Sequelize(databaseUrl)
    }

    _onSync(): void {}

    async sync(initType: InitType): Promise<void> {
        const options = initOptions[initType]

        let connectionSuccess = false

        while (!connectionSuccess) {
            await waitFor(2000)
            await this.sequelize.authenticate()
                .then(() => {
                    connectionSuccess = true
                })
                .catch((err) => {
                    console.log(err)
                })
        }

        await this.sequelize.sync(options)

        this._onSync()
    }
}

export default SequelizeOrm
