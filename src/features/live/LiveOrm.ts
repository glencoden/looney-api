import { ModelDefined } from 'sequelize'
import SequelizeOrm from '../../db/SequelizeOrm'
import { TSequelizeOrmProps } from '../../db/types/TSequelizeOrmProps'
import { LipStatus } from './enums/LipStatus'
import { TLip, TLipCreationAttributes } from './types/TLip'
import { TSession, TSessionCreationAttributes } from './types/TSession'
import lipModel from './models/lip'
import sessionModel from './models/session'

class LiveOrm extends SequelizeOrm {
    Lip: ModelDefined<TLip, TLipCreationAttributes>
    Session: ModelDefined<TSession, TSessionCreationAttributes>

    constructor(props: TSequelizeOrmProps) {
        super(props)

        this.Lip = this.sequelize.define('Lip', lipModel)
        this.Session = this.sequelize.define('Session', sessionModel)
    }

    // lips

    getAllLips() {
        return this.Lip.findAll() as unknown as Promise<TLip[]>
    }

    getLipsBySessionId(sessionId: TSession['id']) {
        return this.Lip.findAll({ where: { sessionId } }) as unknown as Promise<TLip[]>
    }

    getLipsByGuestGuid(guestGuid: TLip['guestGuid']) {
        return this.Lip.findAll({ where: { guestGuid } }) as unknown as Promise<TLip[]>
    }

    getLip(id: TLip['id']) {
        return this.Lip.findAll({ where: { id } }) as unknown as Promise<TLip[]>
    }

    setLip(lip: TLipCreationAttributes) {
        if (typeof lip.id !== 'number') {
            return this.Lip.create(lip)
        }
        return this.Lip.update(lip, { where: { id: lip.id } })
    }

    deleteLip(id: TLip['id'], message: string) {
        return this.Lip.update({ status: LipStatus.DELETED, message }, { where: { id } })
    }

    // sessions

    getAllSessions() {
        return this.Session.findAll() as unknown as Promise<TSession[]>
    }

    getSession(id: TSession['id']) {
        return this.Session.findAll({ where: { id } }) as unknown as Promise<TSession[]>
    }

    setSession(session: TSessionCreationAttributes) {
        if (typeof session.id !== 'number') {
            return this.Session.create({
                ...session,
                deleted: false,
            })
        }
        return this.Session.update(session, { where: { id: session.id } })
    }

    deleteSession(id: TSession['id']) {
        return this.Session.update({ deleted: true }, { where: { id } })
    }
}

export default LiveOrm