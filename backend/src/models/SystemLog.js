const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');

class SystemLog extends Model {}

SystemLog.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  user_id: { // Can be null if action is system-initiated or pre-login
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id',
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
  },
  action_type: { // e.g., 'ADMIN_LOGIN', 'CREATE_TOPIC', 'USER_LOGOUT'
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  details: { // JSON string for additional information
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
        const rawValue = this.getDataValue('details');
        return rawValue ? JSON.parse(rawValue) : null;
    },
    set(value) {
        this.setDataValue('details', value ? JSON.stringify(value) : null);
    }
  },
  ip_address: {
    type: DataTypes.STRING(45),
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('SUCCESS', 'FAILURE'),
    defaultValue: 'SUCCESS',
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // timestamp is createdAt
}, {
  sequelize,
  modelName: 'SystemLog',
  tableName: 'SystemLogs',
  timestamps: true, // 'timestamp' field in SQL is handled by createdAt
  updatedAt: false, // No need for updatedAt in logs
  underscored: true,
});

module.exports = SystemLog;