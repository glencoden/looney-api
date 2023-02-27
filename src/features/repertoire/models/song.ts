import { DataTypes, ModelAttributes } from 'sequelize'

export default {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    toolKey: DataTypes.STRING,
    artist: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    lyrics: DataTypes.JSON,
    special: DataTypes.BOOLEAN,
} as ModelAttributes