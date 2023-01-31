import 'dotenv/config'
import AuthOrm from './AuthOrm'

export { authRouter } from './authRouter'

const { DB_USER, DB_PASSWORD, DB_HOST, AUTH_DB_NAME } = process.env

const databaseName = AUTH_DB_NAME || 'looney_oauth2'
const databaseUrl = `postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}/${databaseName}`

export const authOrm = new AuthOrm({ databaseUrl })