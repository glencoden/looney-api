import RepertoireOrm from './RepertoireOrm'

export { repertoireRouter } from './repertoireRouter'

const { DB_USER, DB_PASSWORD, DB_HOST, REPERTOIRE_DB_NAME } = process.env

const databaseName = REPERTOIRE_DB_NAME || 'looney_repertoire'
const databaseUrl = `postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}/${databaseName}`

export const repertoireOrm = new RepertoireOrm({ databaseUrl })