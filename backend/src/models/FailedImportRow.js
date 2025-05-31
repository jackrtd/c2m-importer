const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');

class FailedImportRow extends Model {}

FailedImportRow.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  import_log_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'ImportLogs', // Name of the table
      key: 'id',
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  },
  row_number_in_file: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  row_data: { // JSON representation of the row data that failed
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
        const rawValue = this.getDataValue('row_data');
        return rawValue ? JSON.parse(rawValue) : null;
    },
    set(value) {
        this.setDataValue('row_data', value ? JSON.stringify(value) : null);
    }
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // timestamp is createdAt
}, {
  sequelize,
  modelName: 'FailedImportRow',
  tableName: 'FailedImportRows',
  timestamps: true, // 'timestamp' field in SQL is handled by createdAt
  updatedAt: false,
  underscored: true,
});

module.exports = FailedImportRow;