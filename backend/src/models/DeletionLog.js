const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');

class DeletionLog extends Model {}

DeletionLog.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
    // onDelete: 'CASCADE' or 'SET NULL' depending on requirements
  },
  topic_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Topics',
      key: 'id',
    },
    // onDelete: 'CASCADE' or 'SET NULL'
  },
  target_table_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  record_primary_key_value: { // Or TEXT if PKs can be very long/composite
    type: DataTypes.STRING,
    allowNull: false,
  },
  deleted_record_data: { // Store the actual data of the deleted row for rollback
    type: DataTypes.JSON, // Sequelize handles JSON stringification/parsing
    allowNull: false,
  },
  deletion_batch_id: { // UUID to group multiple deletions
    type: DataTypes.STRING(36), // For UUID
    allowNull: true,
  },
  is_rolled_back: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  deleted_at: { // Overrides default createdAt for clarity
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  rolled_back_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  rolled_back_by_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id',
    },
    onDelete: 'SET NULL',
  },
}, {
  sequelize,
  modelName: 'DeletionLog',
  tableName: 'DeletionLogs',
  timestamps: true, // Enables createdAt and updatedAt
  createdAt: 'deleted_at', // Map sequelize's createdAt to deleted_at
  updatedAt: true, // To track when rolled_back_status changes etc.
  underscored: true,
});

module.exports = DeletionLog;