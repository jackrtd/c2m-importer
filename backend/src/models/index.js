const { sequelize } = require('../config/db');

// Import models
const User = require('./User');
const Topic = require('./Topic');
const ColumnMapping = require('./ColumnMapping');
const UserTopicPermission = require('./UserTopicPermission');
const SystemLog = require('./SystemLog');
const ImportLog = require('./ImportLog');
const FailedImportRow = require('./FailedImportRow');
const DeletionLog = require('./DeletionLog');

// --- Define Associations ---

// User associations
User.hasMany(Topic, { foreignKey: 'created_by_id', as: 'createdTopics' });
User.hasMany(UserTopicPermission, { foreignKey: 'user_id', as: 'topicPermissions' });
User.hasMany(SystemLog, { foreignKey: 'user_id', as: 'systemLogs' });
User.hasMany(ImportLog, { foreignKey: 'user_id', as: 'importLogs' });
User.hasMany(DeletionLog, { foreignKey: 'user_id', as: 'deletionLogs' });
User.hasMany(DeletionLog, { foreignKey: 'rolled_back_by_id', as: 'rolledBackDeletions' });


// Topic associations
Topic.belongsTo(User, { foreignKey: 'created_by_id', as: 'creator' });
Topic.hasMany(ColumnMapping, { foreignKey: 'topic_id', as: 'columnMappings', onDelete: 'CASCADE' });
Topic.hasMany(UserTopicPermission, { foreignKey: 'topic_id', as: 'userPermissions', onDelete: 'CASCADE' });
Topic.hasMany(ImportLog, { foreignKey: 'topic_id', as: 'importLogs', onDelete: 'CASCADE' });
Topic.hasMany(DeletionLog, { foreignKey: 'topic_id', as: 'deletionLogs', onDelete: 'CASCADE' });

// ColumnMapping associations
ColumnMapping.belongsTo(Topic, { foreignKey: 'topic_id' });

// UserTopicPermission associations
UserTopicPermission.belongsTo(User, { foreignKey: 'user_id' });
UserTopicPermission.belongsTo(Topic, { foreignKey: 'topic_id' });

// SystemLog associations
SystemLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' }); // 'user' alias for who performed action

// ImportLog associations
ImportLog.belongsTo(User, { foreignKey: 'user_id', as: 'importer' });
ImportLog.belongsTo(Topic, { foreignKey: 'topic_id', as: 'topic' });
ImportLog.hasMany(FailedImportRow, { foreignKey: 'import_log_id', as: 'failedRows', onDelete: 'CASCADE' });

// FailedImportRow associations
FailedImportRow.belongsTo(ImportLog, { foreignKey: 'import_log_id' });

// DeletionLog associations
DeletionLog.belongsTo(User, { foreignKey: 'user_id', as: 'deleter' });
DeletionLog.belongsTo(User, { foreignKey: 'rolled_back_by_id', as: 'rollerBacker' });
DeletionLog.belongsTo(Topic, { foreignKey: 'topic_id' });


// --- Export all models and sequelize instance ---
const db = {
  sequelize,
  Sequelize: require('sequelize'), // Export Sequelize class itself
  User,
  Topic,
  ColumnMapping,
  UserTopicPermission,
  SystemLog,
  ImportLog,
  FailedImportRow,
  DeletionLog,
};

module.exports = db;