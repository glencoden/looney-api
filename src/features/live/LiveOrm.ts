import { ModelDefined, Op } from 'sequelize'
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

    createLip(lip: TLipCreationAttributes) {
        return this.Lip.create(lip)
    }

    getLip(id: TLip['id']) {
        return this.Lip.findAll({ where: { id } }) as unknown as Promise<TLip[]>
    }

    setLip(lip: Partial<TLipCreationAttributes>) {
        switch (lip.status) {
            case LipStatus.DELETED:
                lip.deletedAt = new Date()
                break
            case LipStatus.LIVE:
                lip.liveAt = new Date()
                break
            case LipStatus.DONE:
                lip.doneAt = new Date()
                break
        }

        return this.Lip.update(lip, { where: { id: lip.id } })
    }

    // sessions

    getAllSessions() {
        return this.Session.findAll({
            where: {
                deleted: { [Op.not]: true },
            },
        }) as unknown as Promise<TSession[]>
    }

    getNextSession() {
        const currentDate = new Date()

        return this.Session.findAll({
            where: {
                startDate: {
                    [Op.gt]: currentDate,
                },
                deleted: {
                    [Op.not]: true,
                },
            },
        }) as unknown as Promise<TSession[]>
    }

    getActiveSession() {
        const currentDate = new Date()

        return this.Session.findAll({
            where: {
                startDate: {
                    [Op.lt]: currentDate,
                },
                endDate: {
                    [Op.gt]: currentDate,
                },
                deleted: {
                    [Op.not]: true,
                },
            },
        }) as unknown as Promise<TSession[]>
    }

    createSession(session: TSessionCreationAttributes) {
        return this.Session.create({
            ...session,
            deleted: false,
        })
    }

    getSession(id: TSession['id']) {
        return this.Session.findAll({
            where: {
                id,
                deleted: {
                    [Op.not]: true,
                },
            },
        }) as unknown as Promise<TSession[]>
    }

    setSession(session: TSessionCreationAttributes) {
        return this.Session.update(session, { where: { id: session.id } })
    }

    deleteSession(id: TSession['id']) {
        return this.Session.update({ deleted: true }, { where: { id } })
    }
}

export default LiveOrm