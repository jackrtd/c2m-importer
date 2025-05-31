const { SystemLog, ImportLog, FailedImportRow, DeletionLog } = require('../models'); // Assuming models are in ../models/index.js which exports them

/**
 * Logs a general system action.
 * @param {number | null} userId - The ID of the user performing the action. Null if system action.
 * @param {string} actionType - Type of action (e.g., 'ADMIN_LOGIN', 'CREATE_TOPIC').
 * @param {object | null} details - Additional details about the action (JSON serializable).
 * @param {string | null} ipAddress - IP address of the request.
 * @param {'SUCCESS' | 'FAILURE'} status - Status of the action.
 * @param {string | null} errorMessage - Error message if status is 'FAILURE'.
 */
async function logAction(userId, actionType, details = null, ipAddress = null, status = 'SUCCESS', errorMessage = null) {
  try {
    await SystemLog.create({
      user_id: userId,
      action_type: actionType,
      details: details, // Sequelize model handles JSON.stringify
      ip_address: ipAddress,
      status: status,
      error_message: errorMessage,
    });
  } catch (error) {
    console.error('Failed to write to SystemLog:', error);
    // Avoid throwing error from logger to not break main flow, but log it.
  }
}

/**
 * Creates an initial import log entry.
 * @param {number} userId - ID of the user performing the import.
 * @param {number} topicId - ID of the topic being imported.
 * @param {string} originalFileName - Original name of the uploaded file.
 * @param {string} storedFileName - Name of the file as stored on the server.
 * @param {number} fileSize - Size of the file in bytes.
 * @param {number} totalRecordsInFile - Estimated total records in the file.
 * @returns {Promise<ImportLog>} The created ImportLog instance.
 */
async function createImportLogEntry(userId, topicId, originalFileName, storedFileName, fileSize, totalRecordsInFile) {
  try {
    return await ImportLog.create({
      user_id: userId,
      topic_id: topicId,
      original_file_name: originalFileName,
      file_name: storedFileName,
      file_size: fileSize,
      total_records_in_file: totalRecordsInFile,
      status: 'PENDING', // Initial status
      start_time: new Date(),
    });
  } catch (error) {
    console.error('Failed to create ImportLog entry:', error);
    await logAction(userId, 'IMPORT_LOG_CREATION_FAILURE', { topicId, originalFileName, error: error.message }, null, 'FAILURE', error.message);
    throw error; // Re-throw to be handled by the caller
  }
}

/**
 * Updates an existing import log.
 * @param {number} importLogId - ID of the import log to update.
 * @param {object} updateData - Data to update (e.g., status, counts, endTime, errorDetails).
 */
async function updateImportLog(importLogId, updateData) {
  try {
    const logEntry = await ImportLog.findByPk(importLogId);
    if (logEntry) {
      await logEntry.update(updateData);
    } else {
      console.error(`ImportLog entry with ID ${importLogId} not found for update.`);
    }
  } catch (error) {
    console.error('Failed to update ImportLog:', error);
    // Log this failure as a system log, as we don't have user context directly here
    await logAction(null, 'IMPORT_LOG_UPDATE_FAILURE', { importLogId, updateData, error: error.message }, null, 'FAILURE', error.message);
  }
}

/**
 * Logs rows that failed during an import process.
 * @param {number} importLogId - ID of the parent import log.
 * @param {Array<{row_number_in_file: number, row_data: object, error_message: string}>} failedRowsData
 */
async function logFailedImportRows(importLogId, failedRowsData) {
  if (!failedRowsData || failedRowsData.length === 0) {
    return;
  }
  try {
    const dataToInsert = failedRowsData.map(row => ({
      import_log_id: importLogId,
      ...row
    }));
    await FailedImportRow.bulkCreate(dataToInsert);
  } catch (error) {
    console.error('Failed to log failed import rows:', error);
    await logAction(null, 'FAILED_ROW_LOGGING_FAILURE', { importLogId, count: failedRowsData.length, error: error.message }, null, 'FAILURE', error.message);
  }
}


/**
 * Logs a data deletion action.
 * @param {number} userId - ID of the user performing the deletion.
 * @param {number} topicId - ID of the topic from which data is deleted.
 * @param {string} targetTableName - Name of the table in the target DB.
 * @param {string} recordPKValue - Primary key value of the deleted record.
 * @param {object} deletedRecordData - The actual data of the deleted record (for rollback).
 * @param {string | null} deletionBatchId - Optional UUID to group multiple deletions.
 * @returns {Promise<DeletionLog>} The created DeletionLog instance.
 */
async function logDeletion(userId, topicId, targetTableName, recordPKValue, deletedRecordData, deletionBatchId = null) {
  try {
    return await DeletionLog.create({
      user_id: userId,
      topic_id: topicId,
      target_table_name: targetTableName,
      record_primary_key_value: recordPKValue,
      deleted_record_data: deletedRecordData, // Sequelize model handles JSON
      deletion_batch_id: deletionBatchId,
      is_rolled_back: false,
      // deleted_at is set by default by model
    });
  } catch (error) {
    console.error('Failed to log deletion:', error);
    await logAction(userId, 'DELETION_LOG_FAILURE', { topicId, targetTableName, recordPKValue, error: error.message }, null, 'FAILURE', error.message);
    throw error;
  }
}

/**
 * Marks deletion logs as rolled back.
 * @param {Array<number>} deletionLogIds - Array of DeletionLog IDs to mark as rolled back.
 * @param {number} rolledBackById - User ID of the person who initiated the rollback.
 */
async function markDeletionsAsRolledBack(deletionLogIds, rolledBackById) {
    if (!deletionLogIds || deletionLogIds.length === 0) return;
    try {
        await DeletionLog.update(
            { is_rolled_back: true, rolled_back_at: new Date(), rolled_back_by_id: rolledBackById },
            { where: { id: deletionLogIds, is_rolled_back: false } } // Only update if not already rolled back
        );
    } catch (error) {
        console.error('Failed to mark deletions as rolled back:', error);
        await logAction(rolledBackById, 'ROLLBACK_MARKING_FAILURE', { deletionLogIds, error: error.message }, null, 'FAILURE', error.message);
    }
}


module.exports = {
  logAction,
  createImportLogEntry,
  updateImportLog,
  logFailedImportRows,
  logDeletion,
  markDeletionsAsRolledBack,
};