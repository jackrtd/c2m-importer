// backend/src/controllers/userController.js
const { Topic, UserTopicPermission, ColumnMapping, ImportLog, FailedImportRow, DeletionLog, User, sequelize } = require('../models'); // Ensure User is included here
const logService = require('../services/logService');
const dbService = require('../services/dbService'); 
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid'); 

// Helper functions for date formatting (can be moved to a utility file if used elsewhere)
function formatDateTimeForMySQL(isoString) {
    if (!isoString) return null;
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return isoString; // Return original if invalid date string

        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch (e) {
        console.warn(`Could not parse date string for DATETIME formatting: ${isoString}`, e);
        return isoString; // Return original on error
    }
}

function formatDateForMySQL(isoString) {
    if (!isoString) return null;
     try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return isoString; // Return original if invalid date string

        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) {
        console.warn(`Could not parse date string for DATE formatting: ${isoString}`, e);
        return isoString; // Return original on error
    }
}


/**
 * @desc    Get topics available for the logged-in user to import
 * @route   GET /api/user/topics
 * @access  Private/User
 */
const getAvailableTopics = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const permissions = await UserTopicPermission.findAll({
      where: { user_id: userId, can_import: true },
      include: [{
        model: Topic,
        as: 'Topic', 
        attributes: ['id', 'name', 'target_table_name'], 
        include: [{
            model: ColumnMapping,
            as: 'columnMappings', 
            attributes: ['source_column_name', 'target_column_name', 'data_type', 'is_primary_key']
        }]
      }]
    });

    const availableTopics = permissions.map(p => p.Topic).filter(topic => topic != null); 

    await logService.logAction(userId, 'USER_GET_AVAILABLE_TOPICS', { count: availableTopics.length }, req.ip);
    res.json({ success: true, topics: availableTopics });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get imported data for a specific topic that the user has permission to view
 * @route   GET /api/user/topics/:topicId/data
 * @access  Private/User
 */
const getImportedDataByTopic = async (req, res, next) => {
  const { topicId } = req.params;
  const userId = req.user.id;
  
  let page = parseInt(req.query.page, 10);
  let limit = parseInt(req.query.limit, 10);

  page = (isNaN(page) || page < 1) ? 1 : page;
  limit = (isNaN(limit) || limit < 1) ? 10 : limit; // Default limit to 10 if invalid

  const { sortBy, sortOrder = 'ASC', filters } = req.query; 
  const offset = (page - 1) * limit;

  try {
    const permission = await UserTopicPermission.findOne({
      where: { user_id: userId, topic_id: topicId, can_view_data: true },
      include: [{ model: Topic, as: 'Topic' }]
    });

    if (!permission || !permission.Topic) {
      await logService.logAction(userId, 'USER_GET_TOPIC_DATA_FAILURE', { topicId, reason: 'Permission denied or topic not found' }, req.ip, 'FAILURE');
      return res.status(403).json({ message: 'You do not have permission to view data for this topic or topic not found.' });
    }

    const topicConfig = permission.Topic;
    const columnMappings = await ColumnMapping.findAll({ where: { topic_id: topicId } });

    if (!columnMappings || columnMappings.length === 0) {
        await logService.logAction(userId, 'USER_GET_TOPIC_DATA_FAILURE', { topicId, reason: 'No column mappings configured for this topic.' }, req.ip, 'FAILURE');
        return res.status(400).json({ message: 'No column mappings configured for this topic. Cannot fetch data.' });
    }

    let parsedFilters = [];
    if (filters) {
        try {
            parsedFilters = JSON.parse(filters);
            if (!Array.isArray(parsedFilters)) parsedFilters = [];
        } catch (e) {
            console.warn("Invalid filters format:", filters);
        }
    }

    const dataOptions = {
        page: page, // Use sanitized page
        limit: limit, // Use sanitized limit
        sortBy: sortBy, 
        sortOrder: sortOrder,
        filters: parsedFilters,
        offset: offset // Pass calculated offset
    };

    const result = await dbService.getData(topicConfig.toJSON(), columnMappings.map(cm => cm.toJSON()), dataOptions);

    await logService.logAction(userId, 'USER_VIEW_TOPIC_DATA', { topicId, page, limit, count: result.data.length }, req.ip);
    res.json({ 
        success: true, 
        ...result, 
        columnMappings: columnMappings.map(cm => cm.toJSON()) 
    }); 

  } catch (error) {
    if (error.message.includes("connect ECONNREFUSED") || error.code === 'ECONNREFUSED' || error.code === 'ER_ACCESS_DENIED_ERROR' || error.code === 'ER_DBACCESS_DENIED_ERROR') {
        await logService.logAction(userId, 'USER_GET_TOPIC_DATA_DB_ERROR', { topicId, error: "Target database connection failed." }, req.ip, 'FAILURE', "Target database connection failed.");
        return res.status(503).json({ message: "Could not connect to the target database. Please check topic configuration or contact an administrator." });
    }
    if (error.code === 'ER_NO_SUCH_TABLE') {
         await logService.logAction(userId, 'USER_GET_TOPIC_DATA_DB_ERROR', { topicId, error: "Target table not found." }, req.ip, 'FAILURE', "Target table not found.");
        return res.status(404).json({ message: "The target table for this topic does not exist. Please contact an administrator." });
    }
    next(error);
  }
};

/**
 * @desc    Delete imported records for a specific topic
 * @route   POST /api/user/topics/:topicId/data/delete
 * @access  Private/User
 */
const deleteImportedData = async (req, res, next) => {
  const { topicId } = req.params;
  const userId = req.user.id;
  const { recordIds } = req.body; 

  if (!recordIds || !Array.isArray(recordIds) || recordIds.length === 0) {
    return res.status(400).json({ message: 'Please provide an array of recordIds to delete.' });
  }

  const transaction = await sequelize.transaction(); 

  try {
    const permission = await UserTopicPermission.findOne({
      where: { user_id: userId, topic_id: topicId, can_delete_data: true },
      include: [{ model: Topic, as: 'Topic' }]
    }, { transaction });

    if (!permission || !permission.Topic) {
      await transaction.rollback();
      await logService.logAction(userId, 'USER_DELETE_TOPIC_DATA_FAILURE', { topicId, reason: 'Permission denied or topic not found' }, req.ip, 'FAILURE');
      return res.status(403).json({ message: 'You do not have permission to delete data for this topic or topic not found.' });
    }

    const topicConfig = permission.Topic;
    const columnMappings = await ColumnMapping.findAll({ where: { topic_id: topicId }, transaction });
    const primaryKeyMapping = columnMappings.find(m => m.is_primary_key);

    if (!primaryKeyMapping) {
      await transaction.rollback();
      await logService.logAction(userId, 'USER_DELETE_TOPIC_DATA_FAILURE', { topicId, reason: 'No primary key defined for this topic. Deletion by ID is not possible.' }, req.ip, 'FAILURE');
      return res.status(400).json({ message: 'No primary key defined for this topic. Cannot delete records.' });
    }
    const pkColumnName = primaryKeyMapping.target_column_name;

    let recordsToDeleteData = [];
    try {
        recordsToDeleteData = await dbService.getRecordsByPKs(topicConfig.toJSON(), pkColumnName, recordIds);
    } catch (fetchError) {
        console.warn(`Could not fetch records for deletion logging (Topic ${topicId}): ${fetchError.message}`);
        await logService.logAction(userId, 'USER_DELETE_FETCH_FOR_LOG_WARN', { topicId, recordIdsCount: recordIds.length, error: fetchError.message }, req.ip, 'FAILURE');
    }

    const { deletedCount, errors: deletionErrors } = await dbService.deleteDataByPK(topicConfig.toJSON(), pkColumnName, recordIds);

    const deletionBatchId = uuidv4();
    const successfulDeletionsForLog = recordsToDeleteData.filter(
        record => !deletionErrors.some(err => String(err.pkValue) === String(record[pkColumnName]))
    );

    for (const recordData of successfulDeletionsForLog) {
      await logService.logDeletion(
        userId,
        topicId,
        topicConfig.target_table_name,
        String(recordData[pkColumnName]), 
        recordData, 
        deletionBatchId,
      );
    }
    
    await transaction.commit(); 

    if (deletionErrors.length > 0) {
      await logService.logAction(userId, 'USER_DELETE_TOPIC_DATA_PARTIAL_SUCCESS', { topicId, deletedCount, failedCount: deletionErrors.length, errors: deletionErrors }, req.ip, 'FAILURE'); 
      return res.status(207).json({ 
        success: false, 
        message: `Successfully deleted ${deletedCount} records. Failed to delete ${deletionErrors.length} records.`,
        deletedCount,
        errors: deletionErrors
      });
    }

    await logService.logAction(userId, 'USER_DELETE_TOPIC_DATA_SUCCESS', { topicId, deletedCount }, req.ip);
    res.json({ success: true, message: `Successfully deleted ${deletedCount} records.`, deletedCount });

  } catch (error) {
    if (transaction && transaction.finished !== 'commit' && transaction.finished !== 'rollback') { 
        await transaction.rollback();
    }
     if (error.message.includes("connect ECONNREFUSED") || error.code === 'ECONNREFUSED' || error.code === 'ER_ACCESS_DENIED_ERROR' || error.code === 'ER_DBACCESS_DENIED_ERROR') {
        await logService.logAction(userId, 'USER_DELETE_TOPIC_DATA_DB_ERROR', { topicId, error: "Target database connection failed." }, req.ip, 'FAILURE', "Target database connection failed.");
        return res.status(503).json({ message: "Could not connect to the target database. Please check topic configuration or contact an administrator." });
    }
    if (error.code === 'ER_NO_SUCH_TABLE') {
         await logService.logAction(userId, 'USER_DELETE_TOPIC_DATA_DB_ERROR', { topicId, error: "Target table not found." }, req.ip, 'FAILURE', "Target table not found.");
        return res.status(404).json({ message: "The target table for this topic does not exist. Please contact an administrator." });
    }
    next(error);
  }
};


/**
 * @desc    Rollback deleted data for a specific topic based on deletion batch ID or individual log IDs
 * @route   POST /api/user/topics/:topicId/data/rollback
 * @access  Private/User (or Admin, depending on policy)
 */
const rollbackDeletedData = async (req, res, next) => {
    const { topicId } = req.params;
    const userId = req.user.id; 
    const { deletionLogIds, deletionBatchId } = req.body; 

    if (!deletionLogIds && !deletionBatchId) {
        return res.status(400).json({ message: 'Please provide either deletionLogIds or a deletionBatchId to rollback.' });
    }

    const systemDbTransaction = await sequelize.transaction();
    try {
        const permission = await UserTopicPermission.findOne({
            where: { user_id: userId, topic_id: topicId, can_delete_data: true }, 
            include: [{ model: Topic, as: 'Topic' }]
        }, { transaction: systemDbTransaction });

        if (!permission || !permission.Topic) {
            await systemDbTransaction.rollback();
            await logService.logAction(userId, 'USER_ROLLBACK_DATA_FAILURE', { topicId, reason: 'Permission denied or topic not found' }, req.ip, 'FAILURE');
            return res.status(403).json({ message: 'You do not have permission for this topic or topic not found.' });
        }
        const topicConfig = permission.Topic;

        const whereClause = { topic_id: topicId, is_rolled_back: false };
        if (deletionLogIds) {
            whereClause.id = { [Op.in]: deletionLogIds };
        } else if (deletionBatchId) {
            whereClause.deletion_batch_id = deletionBatchId;
        }

        const logsToRollback = await DeletionLog.findAll({ where: whereClause, transaction: systemDbTransaction });

        if (!logsToRollback || logsToRollback.length === 0) {
            await systemDbTransaction.rollback();
            await logService.logAction(userId, 'USER_ROLLBACK_DATA_FAILURE', { topicId, reason: 'No eligible deletion logs found for rollback.' }, req.ip, 'FAILURE');
            return res.status(404).json({ message: 'No eligible deletion logs found for rollback.' });
        }

        const columnMappings = await ColumnMapping.findAll({ where: { topic_id: topicId }, transaction: systemDbTransaction });
        if (!columnMappings || columnMappings.length === 0) {
            await systemDbTransaction.rollback();
            return res.status(400).json({ message: 'Column mappings for this topic are missing. Cannot perform rollback.' });
        }
        
        // Prepare data for re-insertion, formatting dates based on columnMappings
        const dataToReinsert = logsToRollback.map(log => {
            const originalRecordData = log.deleted_record_data; // This is an object
            const formattedRecordData = {};
            for (const key in originalRecordData) {
                if (originalRecordData.hasOwnProperty(key)) {
                    const mapping = columnMappings.find(m => m.target_column_name === key);
                    let value = originalRecordData[key];
                    if (mapping && value !== null && value !== undefined) {
                        const dataTypeUpper = mapping.data_type ? mapping.data_type.toUpperCase() : '';
                        if (dataTypeUpper.includes('DATE') && !dataTypeUpper.includes('DATETIME') && !dataTypeUpper.includes('TIMESTAMP')) {
                            value = formatDateForMySQL(value);
                        } else if (dataTypeUpper.includes('DATETIME') || dataTypeUpper.includes('TIMESTAMP')) {
                            value = formatDateTimeForMySQL(value);
                        }
                    }
                    formattedRecordData[key] = value;
                }
            }
            return formattedRecordData;
        });

        const rollbackColumnMappings = columnMappings.map(m => ({
            source_column_name: m.target_column_name, 
            target_column_name: m.target_column_name,
        }));

        const { successfullyImported: successfullyRestored, failedCount: restoreFailedCount, failedRowDetails: restoreFailedDetails } =
            await dbService.insertDataBatch(topicConfig.toJSON(), dataToReinsert, rollbackColumnMappings, null );

        if (successfullyRestored > 0) {
            const rolledBackLogIds = logsToRollback
                .filter((log, index) => {
                    if (!restoreFailedDetails || restoreFailedDetails.length === 0) return true; 
                    return !restoreFailedDetails.some(failedDetail => 
                        JSON.stringify(failedDetail.row_data) === JSON.stringify(dataToReinsert[index])
                    );
                })
                .map(log => log.id);

            if (rolledBackLogIds.length > 0) {
                 await DeletionLog.update(
                    { is_rolled_back: true, rolled_back_at: new Date(), rolled_back_by_id: userId },
                    { where: { id: { [Op.in]: rolledBackLogIds } }, transaction: systemDbTransaction }
                );
            }
        }
        
        await systemDbTransaction.commit();

        if (restoreFailedCount > 0) {
            await logService.logAction(userId, 'USER_ROLLBACK_DATA_PARTIAL_SUCCESS', { topicId, restoredCount: successfullyRestored, failedCount: restoreFailedCount, errors: restoreFailedDetails }, req.ip, 'FAILURE');
            return res.status(207).json({
                success: false,
                message: `Successfully restored ${successfullyRestored} records. Failed to restore ${restoreFailedCount} records.`,
                restoredCount: successfullyRestored,
                errors: restoreFailedDetails
            });
        }

        await logService.logAction(userId, 'USER_ROLLBACK_DATA_SUCCESS', { topicId, restoredCount: successfullyRestored }, req.ip);
        res.json({ success: true, message: `Successfully rolled back and restored ${successfullyRestored} records.` });

    } catch (error) {
        if (systemDbTransaction && systemDbTransaction.finished !== 'commit' && systemDbTransaction.finished !== 'rollback') {
            await systemDbTransaction.rollback();
        }
        if (error.message.includes("connect ECONNREFUSED") || error.code === 'ECONNREFUSED' || error.code === 'ER_ACCESS_DENIED_ERROR' || error.code === 'ER_DBACCESS_DENIED_ERROR') {
            await logService.logAction(userId, 'USER_ROLLBACK_DATA_DB_ERROR', { topicId, error: "Target database connection failed." }, req.ip, 'FAILURE', "Target database connection failed.");
            return res.status(503).json({ message: "Could not connect to the target database for rollback. Please check topic configuration or contact an administrator." });
        }
        next(error);
    }
};


/**
 * @desc    Get user's own import logs
 * @route   GET /api/user/logs/import
 * @access  Private/User
 */
const getMyImportLogs = async (req, res, next) => {
  const userId = req.user.id;
  try {
    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);

    page = (isNaN(page) || page < 1) ? 1 : page;
    limit = (isNaN(limit) || limit < 1) ? 10 : limit;

    const { topicId, status, startDate, endDate, sortOrder = 'DESC' } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = { user_id: userId }; 
    if (topicId) whereClause.topic_id = topicId;
    if (status) whereClause.status = status;
    if (startDate && endDate) {
        whereClause.created_at = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    } else if (startDate) {
        whereClause.created_at = { [Op.gte]: new Date(startDate) };
    } else if (endDate) {
        whereClause.created_at = { [Op.lte]: new Date(endDate) };
    }

    const { count, rows } = await ImportLog.findAndCountAll({
      where: whereClause,
      include: [
        { model: Topic, as: 'topic', attributes: ['id', 'name'] },
        { model: FailedImportRow, as: 'failedRows', attributes: ['id'] }
      ],
      order: [['created_at', sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC']],
      limit: limit, 
      offset: offset,
    });

    const logsWithFailedCount = rows.map(log => {
        const logJSON = log.toJSON();
        logJSON.failedRowsCount = logJSON.failedRows ? logJSON.failedRows.length : 0;
        return logJSON;
    });

    await logService.logAction(userId, 'USER_VIEW_OWN_IMPORT_LOGS', { query: req.query, count: logsWithFailedCount.length }, req.ip);
    res.json({
        success: true,
        count,
        totalPages: Math.ceil(count / limit),
        currentPage: page, 
        logs: logsWithFailedCount
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get details of failed rows for a specific import log owned by the user
 * @route   GET /api/user/logs/import/:importLogId/failed-rows
 * @access  Private/User
 */
const getFailedRowsForImportLog = async (req, res, next) => {
    const userId = req.user.id;
    const { importLogId } = req.params;
    
    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);

    page = (isNaN(page) || page < 1) ? 1 : page;
    limit = (isNaN(limit) || limit < 1) ? 100 : limit; 
    
    const offset = (page - 1) * limit;

    try {
        const importLog = await ImportLog.findOne({
            where: { id: importLogId, user_id: userId }
        });

        if (!importLog) {
            await logService.logAction(userId, 'GET_FAILED_ROWS_FAILURE', { importLogId, reason: "Import log not found or access denied" }, req.ip, 'FAILURE');
            return res.status(404).json({ message: "Import log not found or access denied." });
        }

        const { count, rows } = await FailedImportRow.findAndCountAll({
            where: { import_log_id: importLogId },
            limit: limit, 
            offset: offset,
            order: [['row_number_in_file', 'ASC']]
        });

        await logService.logAction(userId, 'GET_FAILED_ROWS_SUCCESS', { importLogId, count: rows.length }, req.ip);
        res.json({
            success: true,
            count,
            totalPages: Math.ceil(count / limit),
            currentPage: page, 
            failedRows: rows
        });

    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get deletion logs for a specific topic that the user has permission to view/manage
 * @route   GET /api/user/topics/:topicId/deletion-logs
 * @access  Private/User (or Admin)
 */
const getDeletionLogsForTopic = async (req, res, next) => {
  const { topicId } = req.params;
  const userId = req.user.id; 
  
  let page = parseInt(req.query.page, 10);
  let limit = parseInt(req.query.limit, 10);

  page = (isNaN(page) || page < 1) ? 1 : page;
  limit = (isNaN(limit) || limit < 1) ? 10 : limit;

  const { is_rolled_back, sortOrder = 'DESC' } = req.query;
  const offset = (page - 1) * limit;

  try {
    const permission = await UserTopicPermission.findOne({
      where: {
        user_id: userId,
        topic_id: topicId,
        [Op.or]: [
          { can_view_data: true },
          { can_delete_data: true } 
        ]
      }
    });

    if (!permission) {
      await logService.logAction(userId, 'GET_DELETION_LOGS_FAILURE', { topicId, reason: 'Permission denied for topic' }, req.ip, 'FAILURE');
      return res.status(403).json({ message: 'You do not have permission to view deletion logs for this topic.' });
    }

    const whereClause = { topic_id: topicId };
    if (is_rolled_back !== undefined) {
      whereClause.is_rolled_back = (is_rolled_back === 'true' || is_rolled_back === true || is_rolled_back === '1');
    }
    
    const order = [['deleted_at', sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC']];

    const { count, rows } = await DeletionLog.findAndCountAll({
      where: whereClause,
      include: [
        { model: User, as: 'deleter', attributes: ['id', 'username'] }, 
      ],
      limit: limit, 
      offset: offset,
      order: order
    });

    await logService.logAction(userId, 'GET_DELETION_LOGS_SUCCESS', { topicId, page, limit, count: rows.length }, req.ip);
    res.json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: page, 
      deletionLogs: rows
    });

  } catch (error) {
    console.error(`Error fetching deletion logs for topic ${topicId}:`, error);
    next(error);
  }
};

module.exports = {
    getAvailableTopics,
    getImportedDataByTopic,
    deleteImportedData,
    rollbackDeletedData,
    getMyImportLogs,
    getFailedRowsForImportLog,
    getDeletionLogsForTopic
};
