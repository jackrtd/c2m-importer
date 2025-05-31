// backend/src/controllers/importController.js
const fs = require('fs').promises; // For async file operations like unlinking
const path = require('path');
const multer = require('multer');
const { Topic, UserTopicPermission, ColumnMapping, ImportLog } = require('../models');
const logService = require('../services/logService');
const dbService = require('../services/dbService');
const fileParserService = require('../services/fileParserService');
const { v4: uuidv4 } = require('uuid');

// --- Multer Setup for File Uploads ---
const UPLOAD_DIR = path.join(__dirname, '../../uploads'); // Define upload directory

// Ensure upload directory exists
fs.mkdir(UPLOAD_DIR, { recursive: true }).catch(err => {
    console.error("Failed to create upload directory:", err);
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    // Generate a unique filename to avoid collisions
    cb(null, `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only excel and csv
  if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || // .xlsx
      file.mimetype === 'application/vnd.ms-excel' || // .xls
      file.mimetype === 'text/csv') {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only Excel (XLS, XLSX) and CSV files are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 1024 * 1024 * 25 } // 25MB file size limit
}).single('importFile'); // 'importFile' is the name of the field in the form-data

/**
 * @desc    Upload a file and initiate the import process for a given topic
 * @route   POST /api/import/topic/:topicId
 * @access  Private/User (with specific topic import permission)
 */
exports.uploadFileAndInitiateImport = async (req, res, next) => {
  upload(req, res, async function (err) {
    const userId = req.user.id;
    const { topicId } = req.params;
    let importLogEntry; // To store the created import log DB object
    let filePath; // To store path of uploaded file for cleanup

    // --- Handle Multer Errors First ---
    if (err instanceof multer.MulterError) {
      // A Multer error occurred when uploading.
      await logService.logAction(userId, 'FILE_UPLOAD_MULTER_ERROR', { topicId, error: err.message }, req.ip, 'FAILURE', err.message);
      return res.status(400).json({ success: false, message: `File upload error: ${err.message}` });
    } else if (err) {
      // An unknown error occurred when uploading (e.g., file type validation).
      await logService.logAction(userId, 'FILE_UPLOAD_UNKNOWN_ERROR', { topicId, error: err.message }, req.ip, 'FAILURE', err.message);
      return res.status(400).json({ success: false, message: err.message });
    }

    // --- Proceed if file uploaded successfully ---
    if (!req.file) {
      await logService.logAction(userId, 'FILE_UPLOAD_NO_FILE', { topicId }, req.ip, 'FAILURE', 'No file was uploaded.');
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    filePath = req.file.path; // Get file path for processing and cleanup

    try {
      // 1. Check User Permission for the Topic
      const permission = await UserTopicPermission.findOne({
        where: { user_id: userId, topic_id: topicId, can_import: true },
        include: [{ model: Topic, as: 'Topic' }]
      });

      if (!permission || !permission.Topic) {
        await logService.logAction(userId, 'IMPORT_PERMISSION_DENIED', { topicId }, req.ip, 'FAILURE');
        throw { statusCode: 403, message: 'You do not have permission to import data for this topic or topic not found.' };
      }
      const topicConfig = permission.Topic;

      // 2. Get Column Mappings for the Topic
      const columnMappings = await ColumnMapping.findAll({ where: { topic_id: topicId } });
      if (!columnMappings || columnMappings.length === 0) {
        await logService.logAction(userId, 'IMPORT_NO_MAPPINGS', { topicId }, req.ip, 'FAILURE');
        throw { statusCode: 400, message: 'No column mappings configured for this topic. Cannot proceed with import.' };
      }

      // 3. Create Initial Import Log (Status: PENDING or PROCESSING)
      // We need to parse the file first to get total records for a more accurate initial log.
      // However, parsing can take time. For a quick response, we can create a PENDING log first.
      // Let's create PENDING log first.
      importLogEntry = await logService.createImportLogEntry(
        userId,
        topicId,
        req.file.originalname,
        req.file.filename,
        req.file.size,
        null // total_records_in_file will be updated after parsing
      );
      await logService.updateImportLog(importLogEntry.id, { status: 'PROCESSING', start_time: new Date() });


      // 4. Parse the uploaded file
      let parsedData;
      try {
        parsedData = await fileParserService.parseFile(filePath, req.file.originalname);
        if (!parsedData || parsedData.length === 0) {
            await logService.updateImportLog(importLogEntry.id, { status: 'FAILED', error_details: { message: 'File is empty or could not be parsed correctly.' }, end_time: new Date() });
            throw { statusCode: 400, message: 'The uploaded file is empty or could not be parsed.' };
        }
        // Update import log with total records from file
        await logService.updateImportLog(importLogEntry.id, { total_records_in_file: parsedData.length });

      } catch (parseError) {
        await logService.updateImportLog(importLogEntry.id, { status: 'FAILED', error_details: { message: `File parsing error: ${parseError.message}` }, end_time: new Date() });
        throw { statusCode: 400, message: `Error parsing file: ${parseError.message}` };
      }


      // 5. (Optional but Recommended) Schema Validation: Compare headers from file with source_column_names in mappings
      if (parsedData.length > 0) {
          const fileHeaders = Object.keys(parsedData[0]);
          const mappedSourceColumns = new Set(columnMappings.map(m => m.source_column_name));
          const missingInFile = [...mappedSourceColumns].filter(col => !fileHeaders.includes(col));
          const extraInFile = fileHeaders.filter(header => !mappedSourceColumns.has(header) && !columnMappings.some(m => m.target_column_name === header)); // Check if it's an unmapped target

          if (missingInFile.length > 0 && process.env.SCHEMA_VALIDATION_STRICT === 'true') { // Strict mode: fail if mapped columns are missing
              const errorMsg = `Schema mismatch: Required source columns missing in file: ${missingInFile.join(', ')}.`;
              await logService.updateImportLog(importLogEntry.id, { status: 'FAILED', error_details: { message: errorMsg, missingColumns: missingInFile }, end_time: new Date() });
              throw { statusCode: 400, message: errorMsg };
          } else if (missingInFile.length > 0) {
              // Non-strict: Log warning, proceed with available data.
              console.warn(`Schema warning for import ${importLogEntry.id}: Mapped source columns missing in file: ${missingInFile.join(', ')}`);
              await logService.logAction(userId, 'IMPORT_SCHEMA_WARNING', { importLogId: importLogEntry.id, topicId, missingColumns: missingInFile }, req.ip, 'FAILURE'); // Log as system action
          }
          if (extraInFile.length > 0) {
              console.warn(`Schema warning for import ${importLogEntry.id}: Extra unmapped columns found in file: ${extraInFile.join(', ')}`);
              // These extra columns will be ignored if not in columnMappings.
          }
      }
      
      // Add originalRowNumber to each row for better error reporting
      const dataWithRowNumbers = parsedData.map((row, index) => ({ ...row, originalRowNumber: index + 1 }));


      // 6. Ensure Target Database and Table Exist
      // This might be time-consuming, consider if it should be done by admin beforehand or make it optional.
      try {
        await dbService.ensureTableExists(topicConfig.toJSON(), columnMappings.map(cm => cm.toJSON()));
      } catch (dbEnsureError) {
        // If ensuring DB/Table fails, this is critical.
        await logService.updateImportLog(importLogEntry.id, { status: 'FAILED', error_details: { message: `Failed to ensure target DB/Table: ${dbEnsureError.message}` }, end_time: new Date() });
        throw { statusCode: 500, message: `System error: Could not prepare target database/table. ${dbEnsureError.message}` };
      }

      // 7. Insert Data into Target Database
      const { successfullyImported, failedCount, failedRowDetails } = await dbService.insertDataBatch(
        topicConfig.toJSON(),
        dataWithRowNumbers, // Use data with original row numbers
        columnMappings.map(cm => cm.toJSON()),
        importLogEntry.id // Pass importLogId for detailed logging within dbService if needed
      );

      // 8. Update Import Log with Final Status and Counts
      const finalStatus = failedCount > 0 ? (successfullyImported > 0 ? 'PARTIALLY_COMPLETED' : 'FAILED') : 'COMPLETED';
      await logService.updateImportLog(importLogEntry.id, {
        status: finalStatus,
        successfully_imported_records: successfullyImported,
        failed_records: failedCount,
        end_time: new Date(),
        error_details: failedCount > 0 ? { message: `${failedCount} records failed to import.`, sample_errors: failedRowDetails.slice(0,5) } : null
      });

      // 9. Log Failed Rows (if any) to FailedImportRows table
      if (failedRowDetails && failedRowDetails.length > 0) {
        await logService.logFailedImportRows(importLogEntry.id, failedRowDetails);
      }

      // 10. Send Response
      const responseMessage = finalStatus === 'COMPLETED' ?
        `Import completed successfully. ${successfullyImported} records imported.` :
        `Import ${finalStatus.toLowerCase()}. ${successfullyImported} records imported, ${failedCount} records failed.`;

      await logService.logAction(userId, `IMPORT_PROCESS_${finalStatus}`, { importLogId: importLogEntry.id, topicId, successfullyImported, failedCount }, req.ip);
      res.status(finalStatus === 'FAILED' && successfullyImported === 0 ? 400 : 200).json({
        success: successfullyImported > 0 || failedCount === 0,
        message: responseMessage,
        importLogId: importLogEntry.id,
        successfullyImported,
        failedCount,
        // Optionally send a few failed row details in response, or direct user to logs
        failedSamples: failedRowDetails.slice(0, 5)
      });

    } catch (error) {
      // Catch errors thrown within the try block (e.g., permission, parsing, db ensure)
      const statusCode = error.statusCode || 500;
      const message = error.message || 'An unexpected error occurred during the import process.';
      console.error(`Import process error for topic ${topicId}, user ${userId}:`, error);

      if (importLogEntry && importLogEntry.id) {
        // Ensure the log reflects the failure if not already updated
        const currentLog = await ImportLog.findByPk(importLogEntry.id);
        if (currentLog && currentLog.status !== 'FAILED' && currentLog.status !== 'PARTIALLY_COMPLETED') {
             await logService.updateImportLog(importLogEntry.id, {
                status: 'FAILED',
                error_details: { message: `Critical error: ${message}`, ...(error.details || {}) },
                end_time: new Date()
            });
        }
      } else {
          // Log a generic system error if importLogEntry was not even created
          await logService.logAction(userId, 'IMPORT_PROCESS_CRITICAL_FAILURE', { topicId, error: message }, req.ip, 'FAILURE', message);
      }
      // Ensure `next(error)` is not called if response already sent
      if (!res.headersSent) {
         res.status(statusCode).json({ success: false, message });
      }
    } finally {
      // 11. Cleanup: Delete the uploaded file from server
      if (filePath) {
        try {
          await fs.unlink(filePath);
          console.log(`Successfully deleted uploaded file: ${filePath}`);
        } catch (unlinkError) {
          console.error(`Error deleting uploaded file ${filePath}:`, unlinkError);
          // Log this as a system maintenance issue, but don't fail the user request for this.
          await logService.logAction(null, 'FILE_CLEANUP_ERROR', { filePath, error: unlinkError.message }, null, 'FAILURE');
        }
      }
    }
  }); // End of multer upload callback
};

// Other import-related controller functions can be added here if needed
// For example, cancelling an ongoing import (more complex, requires job queue/status tracking)
// Or retrying failed rows from a specific import log.
