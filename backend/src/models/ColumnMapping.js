const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');

class ColumnMapping extends Model {}

ColumnMapping.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  topic_id: { // Foreign key for Topic
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Topics', // Name of the table
      key: 'id',
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  },
  source_column_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  target_column_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  data_type: { // e.g., VARCHAR(255), INT, TEXT. Used for table creation.
    type: DataTypes.STRING(50),
    allowNull: true, // Or provide a sensible default
  },
  is_primary_key: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  is_index: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  allow_null: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  default_value: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  sequelize,
  modelName: 'ColumnMapping',
  tableName: 'ColumnMappings',
  timestamps: true,
  underscored: true,
  indexes: [ // For the unique constraints defined in SQL
    {
      unique: true,
      fields: ['topic_id', 'source_column_name']
    },
    {
      unique: true,
      fields: ['topic_id', 'target_column_name']
    }
  ]
});

module.exports = ColumnMapping;