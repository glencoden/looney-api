import LiveOrm from './LiveOrm'

export { liveRouter } from './liveRouter'

const { DB_USER, DB_PASSWORD, DB_HOST, LIVE_DB_NAME } = process.env

const databaseName = LIVE_DB_NAME || 'looney_live'
const databaseUrl = `postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}/${databaseName}`

export const liveOrm = new LiveOrm({ databaseUrl })
