const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');

class Topic extends Model {}

Topic.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  target_db_host: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  target_db_port: {
    type: DataTypes.INTEGER,
    defaultValue: 3306,
  },
  target_db_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  target_table_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  target_db_user: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  target_db_password: {
    type: DataTypes.STRING, // In a real app, consider encrypting this
    allowNull: false,
  },
  created_by_id: { // Foreign key for User
    type: DataTypes.INTEGER,
    allowNull: true, // Or false if a creator is mandatory
    references: {
      model: 'Users', // Name of the table
      key: 'id',
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
  },
}, {
  sequelize,
  modelName: 'Topic',
  tableName: 'Topics',
  timestamps: true,
  underscored: true,
});

module.exports = Topic;