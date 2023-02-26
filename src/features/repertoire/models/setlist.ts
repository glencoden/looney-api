import { DataTypes, ModelAttributes } from 'sequelize'

export default {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    toolKey: DataTypes.STRING,
    title: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    songs: DataTypes.ARRAY(DataTypes.INTEGER),
    songsByToolKeyId: DataTypes.ARRAY(DataTypes.STRING),
    published: DataTypes.BOOLEAN,
} as ModelAttributes