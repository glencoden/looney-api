import { DataTypes, ModelAttributes } from 'sequelize'

export default {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    sessionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    songId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    guestGuid: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    guestName: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    index: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    deletedAt: DataTypes.DATE,
    liveAt: DataTypes.DATE,
    doneAt: DataTypes.DATE,
    message: DataTypes.STRING,
} as ModelAttributes