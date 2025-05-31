const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');

class ImportLog extends Model {}

ImportLog.init({
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
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE', // Or SET NULL if you want to keep logs of deleted users
  },
  topic_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Topics',
      key: 'id',
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE', // Or SET NULL
  },
  file_name: { // Stored file name (e.g., UUID based)
    type: DataTypes.STRING,
    allowNull: true,
  },
  original_file_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  file_size: { // In bytes
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  total_records_in_file: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  successfully_imported_records: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  failed_records: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED', 'CANCELLED'),
    allowNull: false,
  },
  start_time: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  end_time: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  error_details: { // Store detailed error messages, perhaps JSON
    type: DataTypes.TEXT,
    allowNull: true,
     get() {
        const rawValue = this.getDataValue('error_details');
        return rawValue ? JSON.parse(rawValue) : null;
    },
    set(value) {
        this.setDataValue('error_details', value ? JSON.stringify(value) : null);
    }
  },
}, {
  sequelize,
  modelName: 'ImportLog',
  tableName: 'ImportLogs',
  timestamps: true, // createdAt will be the submission time
  updatedAt: true, // updatedAt for status changes
  underscored: true,
});

module.exports = ImportLog;