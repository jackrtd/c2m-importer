// backend/src/routes/importRoutes.js
const express = require('express');
const router = express.Router();
const importController = require('../controllers/importController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All routes in this file will be protected.
// Authorization will ensure only users with 'can_import' permission for the specific topic can proceed.
// This specific permission check is handled within the controller.
router.use(protect);

/**
 * @swagger
 * tags:
 * name: Data Import
 * description: Operations for importing data files
 */

/**
 * @swagger
 * /api/import/topic/{topicId}:
 * post:
 * summary: Upload a file (Excel/CSV) and initiate the import process for a given topic
 * tags: [Data Import]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: topicId
 * required: true
 * schema:
 * type: integer
 * description: The ID of the topic to import data into
 * requestBody:
 * required: true
 * content:
 * multipart/form-data:
 * schema:
 * type: object
 * properties:
 * importFile: # This 'name' must match the one used in multer's .single('importFile')
 * type: string
 * format: binary
 * description: The Excel or CSV file to import.
 * responses:
 * 200:
 * description: Import process initiated and completed/partially completed.
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * success:
 * type: boolean
 * message:
 * type: string
 * importLogId:
 * type: integer
 * successfullyImported:
 * type: integer
 * failedCount:
 * type: integer
 * failedSamples:
 * type: array
 * items:
 * type: object # Structure of a failed row detail
 * 400:
 * description: Bad request (e.g., no file, invalid file type, parsing error, schema mismatch, no mappings)
 * 401:
 * description: Not authorized (token invalid or missing)
 * 403:
 * description: Forbidden (user does not have import permission for this topic)
 * 500:
 * description: Internal server error during import (e.g., DB ensure error)
 * 503:
 * description: Target database connection failed during import
 */
// The authorize middleware for specific 'can_import' on topic is handled *inside* the controller
// because it depends on the :topicId param and user's permissions for that specific topic.
// A general role check (e.g., 'user' or 'admin') can be placed here if desired.
router.post('/topic/:topicId', authorize('user', 'admin'), importController.uploadFileAndInitiateImport);

module.exports = router;
