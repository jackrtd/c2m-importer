// backend/src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All routes in this file will be protected and require 'user' or 'admin' role
// Specific 'user' role authorization can be added per route if needed,
// but 'protect' already ensures authentication.
// If an admin needs to access these user routes (e.g., for impersonation or testing),
// 'authorize' middleware should allow both 'user' and 'admin'.
// For now, let's assume these are primarily for 'user' role.
router.use(protect); // Ensures user is logged in
// router.use(authorize('user', 'admin')); // Allows both users and admins to access these routes

/**
 * @swagger
 * tags:
 * name: User - Data Import & Management
 * description: Operations for users to manage their data imports (User access only or Admin for specific actions)
 */

/**
 * @swagger
 * /api/user/topics:
 * get:
 * summary: Get topics available for the logged-in user to import
 * tags: [User - Data Import & Management]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: A list of available topics with their column mappings
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * success:
 * type: boolean
 * topics:
 * type: array
 * items:
 * type: object # Define Topic schema with column mappings
 * properties:
 * id:
 * type: integer
 * name:
 * type: string
 * target_table_name:
 * type: string
 * columnMappings:
 * type: array
 * items:
 * $ref: '#/components/schemas/ColumnMapping'
 * 401:
 * description: Not authorized
 */
router.get('/topics', authorize('user', 'admin'), userController.getAvailableTopics);

/**
 * @swagger
 * /api/user/topics/{topicId}/data:
 * get:
 * summary: Get imported data for a specific topic (paginated, sortable, filterable)
 * tags: [User - Data Import & Management]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: topicId
 * required: true
 * schema:
 * type: integer
 * description: The ID of the topic
 * - in: query
 * name: page
 * schema: { type: integer, default: 1 }
 * - in: query
 * name: limit
 * schema: { type: integer, default: 10 }
 * - in: query
 * name: sortBy
 * schema: { type: string }
 * description: Target column name to sort by
 * - in: query
 * name: sortOrder
 * schema: { type: string, enum: [ASC, DESC], default: "ASC" }
 * - in: query
 * name: filters
 * schema: { type: string }
 * description: JSON string of filter array e.g., '[{"column":"name","value":"test"}]'
 * responses:
 * 200:
 * description: Paginated list of imported data for the topic
 * 400:
 * description: Bad request (e.g., no column mappings)
 * 403:
 * description: Permission denied
 * 404:
 * description: Topic or target table not found
 * 503:
 * description: Target database connection failed
 */
router.get('/topics/:topicId/data', authorize('user', 'admin'), userController.getImportedDataByTopic);

/**
 * @swagger
 * /api/user/topics/{topicId}/data/delete:
 * post:
 * summary: Delete imported records for a specific topic
 * tags: [User - Data Import & Management]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: topicId
 * required: true
 * schema:
 * type: integer
 * description: The ID of the topic
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required: [recordIds]
 * properties:
 * recordIds:
 * type: array
 * items:
 * type: string # Or integer, depending on PK type
 * description: Array of primary key values of records to delete
 * responses:
 * 200:
 * description: Records deleted successfully
 * 207:
 * description: Partial success, some records failed to delete
 * 400:
 * description: Bad request (e.g., missing recordIds, no PK defined)
 * 403:
 * description: Permission denied
 * 503:
 * description: Target database connection failed
 */
router.post('/topics/:topicId/data/delete', authorize('user', 'admin'), userController.deleteImportedData);

/**
 * @swagger
 * /api/user/topics/{topicId}/data/rollback:
 * post:
 * summary: Rollback deleted data for a specific topic
 * tags: [User - Data Import & Management]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: topicId
 * required: true
 * schema:
 * type: integer
 * description: The ID of the topic
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * deletionLogIds:
 * type: array
 * items:
 * type: integer
 * description: Array of specific DeletionLog IDs to rollback.
 * deletionBatchId:
 * type: string
 * description: UUID of a deletion batch to rollback. (Use one or the other)
 * responses:
 * 200:
 * description: Data rolled back successfully
 * 207:
 * description: Partial success, some records failed to restore
 * 400:
 * description: Bad request (e.g., missing IDs, no column mappings)
 * 403:
 * description: Permission denied
 * 404:
 * description: No eligible deletion logs found
 * 503:
 * description: Target database connection failed
 */
router.post('/topics/:topicId/data/rollback', authorize('user', 'admin'), userController.rollbackDeletedData);


/**
 * @swagger
 * /api/user/logs/import:
 * get:
 * summary: Get the logged-in user's own import logs
 * tags: [User - Data Import & Management]
 * security:
 * - bearerAuth: []
 * parameters:
 * # Similar pagination and filtering as admin import logs, but scoped to the user
 * - in: query
 * name: page
 * schema: { type: integer, default: 1 }
 * - in: query
 * name: limit
 * schema: { type: integer, default: 10 }
 * - in: query
 * name: topicId
 * schema: { type: integer }
 * - in: query
 * name: status
 * schema: { type: string, enum: [PENDING, PROCESSING, COMPLETED, PARTIALLY_COMPLETED, FAILED, CANCELLED] }
 * - in: query
 * name: startDate
 * schema: { type: string, format: date }
 * - in: query
 * name: endDate
 * schema: { type: string, format: date }
 * - in: query
 * name: sortOrder
 * schema: { type: string, enum: [ASC, DESC], default: DESC }
 * responses:
 * 200:
 * description: A list of the user's import logs
 */
router.get('/logs/import', authorize('user', 'admin'), userController.getMyImportLogs);

/**
 * @swagger
 * /api/user/logs/import/{importLogId}/failed-rows:
 * get:
 * summary: Get details of failed rows for a specific import log owned by the user
 * tags: [User - Data Import & Management]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: importLogId
 * required: true
 * schema:
 * type: integer
 * description: The ID of the import log
 * - in: query
 * name: page
 * schema: { type: integer, default: 1 }
 * - in: query
 * name: limit
 * schema: { type: integer, default: 100 }
 * responses:
 * 200:
 * description: Paginated list of failed rows for the import log
 * 404:
 * description: Import log not found or access denied
 */
router.get('/logs/import/:importLogId/failed-rows', authorize('user', 'admin'), userController.getFailedRowsForImportLog);



// --- NEW ROUTE for Deletion Logs ---
/**
 * @swagger
 * /api/user/topics/{topicId}/deletion-logs:
 * get:
 * summary: Get deletion logs for a specific topic that the user has access to
 * tags: [User - Data Import & Management]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: topicId
 * required: true
 * schema:
 * type: integer
 * description: The ID of the topic
 * - in: query
 * name: page
 * schema: { type: integer, default: 1 }
 * - in: query
 * name: limit
 * schema: { type: integer, default: 10 }
 * - in: query
 * name: is_rolled_back
 * schema: { type: boolean }
 * description: Filter by rollback status (true, false, or omit for all)
 * - in: query
 * name: sortOrder
 * schema: { type: string, enum: [ASC, DESC], default: "DESC" }
 * description: Sort order for deletion logs (based on deletion_at)
 * responses:
 * 200:
 * description: Paginated list of deletion logs for the topic
 * 403:
 * description: Permission denied to access this topic's deletion logs
 * 404:
 * description: Topic not found
 */
router.get('/topics/:topicId/deletion-logs', authorize('user', 'admin'), userController.getDeletionLogsForTopic);


module.exports = router;

// Ensure components like ColumnMapping are defined in your Swagger setup
/**
 * @swagger
 * components:
 * schemas:
 * ColumnMapping:
 * type: object
 * properties:
 * source_column_name:
 * type: string
 * target_column_name:
 * type: string
 * data_type:
 * type: string
 * is_primary_key:
 * type: boolean
 */
