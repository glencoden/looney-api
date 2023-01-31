import 'dotenv/config'
import { getShaPass } from '../helpers/getShaPass'
import { TUser } from '../types/TUser'

const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env

export default {
    userName: ADMIN_USERNAME,
    password: getShaPass(ADMIN_PASSWORD as string),
} as TUser