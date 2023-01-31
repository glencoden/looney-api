import crypto from 'crypto'

export function getShaPass(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex')
}