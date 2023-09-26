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
    date: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    message: DataTypes.STRING,
} as ModelAttributes