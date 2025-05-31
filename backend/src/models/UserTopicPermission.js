const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');

class UserTopicPermission extends Model {}

UserTopicPermission.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  user_id: { // Foreign key for User
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  },
  topic_id: { // Foreign key for Topic
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Topics',
      key: 'id',
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  },
  can_import: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  can_view_data: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  can_delete_data: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  sequelize,
  modelName: 'UserTopicPermission',
  tableName: 'UserTopicPermissions',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'topic_id']
    }
  ]
});

module.exports = UserTopicPermission;