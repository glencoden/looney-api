import { Model, ModelStatic } from 'sequelize'
import SequelizeOrm from '../../db/SequelizeOrm'
import { TSequelizeOrmProps } from '../../db/types/TSequelizeOrmProps'
import { getShaPass } from './helpers/getShaPass'
import accessTokenModel from './models/accessToken'
import userModel from './models/user'
import { TUser } from './types/TUser'
import adminUser from './utils/adminUser'


class AuthOrm extends SequelizeOrm {
    User: ModelStatic<Model>
    AccessToken: ModelStatic<Model>

    constructor(props: TSequelizeOrmProps) {
        super(props)

        this.User = this.sequelize.define('User', userModel)
        this.AccessToken = this.sequelize.define('AccessToken', accessTokenModel)
    }

    _onSync(): void {
        this.User.findAll()
            .then(result => {
                if (result.length > 0) {
                    return
                }
                return this.User.create(adminUser)
            })
            .then(result => console.log('created admin', result))
            .catch(err => console.log('error creating admin', err))
    }

    register({ password, ...user }: TUser): Promise<Model> {
        console.log({
            password: getShaPass(password),
            ...user,
        })
        return this.User.create({
            password: getShaPass(password),
            ...user,
        })
    };

    deleteUser(id: number): Promise<number> {
        return this.User.destroy({
            where: { id },
        })
    };

    getUser(userName: string, password: string): Promise<Model[]> {
        return this.User.findAll({
            where: {
                userName,
                password: getShaPass(password),
            },
        })
    };

    getAllUsers(): Promise<Model[]> {
        return this.User.findAll()
    }

    isValidUser(userName: string): Promise<Model[]> {
        return this.User.findAll({
            where: { userName },
        })
    };

    saveAccessToken(accessToken: string, userId: number): Promise<Model> {
        return this.AccessToken.create({
            accessToken,
            userId,
        })
    };

    getUserIDFromBearerToken(bearerToken: string): Promise<Model[]> {
        return this.AccessToken.findAll({
            where: {
                accessToken: bearerToken,
            },
        })
    };
}

export default AuthOrm