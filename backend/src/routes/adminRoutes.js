// backend/src/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All routes in this file will be protected and require admin role
router.use(protect);
router.use(authorize('admin'));

/**
 * @swagger
 * tags:
 * name: Admin - User Management
 * description: Operations for managing system users (Admin access only)
 */

/**
 * @swagger
 * /api/admin/users:
 * get:
 * summary: Get all users
 * tags: [Admin - User Management]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: query
 * name: page
 * schema:
 * type: integer
 * default: 1
 * description: Page number
 * - in: query
 * name: limit
 * schema:
 * type: integer
 * default: 10
 * description: Number of users per page
 * - in: query
 * name: role
 * schema:
 * type: string
 * enum: [admin, user]
 * description: Filter by user role
 * - in: query
 * name: is_active
 * schema:
 * type: boolean
 * description: Filter by active status
 * - in: query
 * name: search
 * schema:
 * type: string
 * description: Search term for username or email
 * responses:
 * 200:
 * description: A list of users
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * success:
 * type: boolean
 * count:
 * type: integer
 * totalPages:
 * type: integer
 * currentPage:
 * type: integer
 * users:
 * type: array
 * items:
 * $ref: '#/components/schemas/User'
 * 401:
 * description: Not authorized
 * 403:
 * description: Forbidden (not an admin)
 */
router.get('/users', adminController.getAllUsers);

/**
 * @swagger
 * /api/admin/users/{userId}:
 * get:
 * summary: Get a single user by ID
 * tags: [Admin - User Management]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: userId
 * required: true
 * schema:
 * type: integer
 * description: The user ID
 * responses:
 * 200:
 * description: User data
 * 404:
 * description: User not found
 */
router.get('/users/:userId', adminController.getUserById);

/**
 * @swagger
 * /api/admin/users:
 * post:
 * summary: Create a new user
 * tags: [Admin - User Management]
 * security:
 * - bearerAuth: []
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - username
 * - email
 * - password
 * - role
 * properties:
 * username:
 * type: string
 * email:
 * type: string
 * format: email
 * password:
 * type: string
 * role:
 * type: string
 * enum: [admin, user]
 * is_active:
 * type: boolean
 * default: true
 * responses:
 * 201:
 * description: User created successfully
 * 400:
 * description: Invalid input or validation error
 */
router.post('/users', adminController.createUser);

/**
 * @swagger
 * /api/admin/users/{userId}:
 * put:
 * summary: Update a user
 * tags: [Admin - User Management]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: userId
 * required: true
 * schema:
 * type: integer
 * description: The user ID
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * username:
 * type: string
 * email:
 * type: string
 * format: email
 * password:
 * type: string
 * description: Optional. Provide only if changing password.
 * role:
 * type: string
 * enum: [admin, user]
 * is_active:
 * type: boolean
 * responses:
 * 200:
 * description: User updated successfully
 * 400:
 * description: Invalid input or validation error
 * 404:
 * description: User not found
 */
router.put('/users/:userId', adminController.updateUser);

/**
 * @swagger
 * /api/admin/users/{userId}:
 * delete:
 * summary: Delete a user
 * tags: [Admin - User Management]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: userId
 * required: true
 * schema:
 * type: integer
 * description: The user ID
 * responses:
 * 200:
 * description: User deleted successfully
 * 403:
 * description: Cannot delete self
 * 404:
 * description: User not found
 */
router.delete('/users/:userId', adminController.deleteUser);


/**
 * @swagger
 * tags:
 * name: Admin - Topic Management
 * description: Operations for managing import topics (Admin access only)
 */

/**
 * @swagger
 * /api/admin/topics:
 * post:
 * summary: Create a new import topic
 * tags: [Admin - Topic Management]
 * security:
 * - bearerAuth: []
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required: [name, target_db_host, target_db_name, target_table_name, target_db_user, target_db_password]
 * properties:
 * name:
 * type: string
 * target_db_host:
 * type: string
 * target_db_port:
 * type: integer
 * default: 3306
 * target_db_name:
 * type: string
 * target_table_name:
 * type: string
 * target_db_user:
 * type: string
 * target_db_password:
 * type: string
 * column_mappings:
 * type: array
 * items:
 * type: object
 * required: [source_column_name, target_column_name]
 * properties:
 * source_column_name:
 * type: string
 * target_column_name:
 * type: string
 * data_type:
 * type: string
 * example: "VARCHAR(255)"
 * is_primary_key:
 * type: boolean
 * default: false
 * is_index:
 * type: boolean
 * default: false
 * allow_null:
 * type: boolean
 * default: true
 * default_value:
 * type: string
 * nullable: true
 * responses:
 * 201:
 * description: Topic created successfully
 * 400:
 * description: Invalid input or validation error
 */
router.post('/topics', adminController.createTopic);

/**
 * @swagger
 * /api/admin/topics:
 * get:
 * summary: Get all topics
 * tags: [Admin - Topic Management]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: A list of topics with their column mappings
 */
router.get('/topics', adminController.getAllTopics);

/**
 * @swagger
 * /api/admin/topics/{topicId}:
 * get:
 * summary: Get a single topic by ID
 * tags: [Admin - Topic Management]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: topicId
 * required: true
 * schema:
 * type: integer
 * description: The topic ID
 * responses:
 * 200:
 * description: Topic data with column mappings and user permissions
 * 404:
 * description: Topic not found
 */
router.get('/topics/:topicId', adminController.getTopicById);

/**
 * @swagger
 * /api/admin/topics/{topicId}:
 * put:
 * summary: Update a topic and its column mappings
 * tags: [Admin - Topic Management]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: topicId
 * required: true
 * schema:
 * type: integer
 * description: The topic ID
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * # Same schema as POST /api/admin/topics, but fields are optional for update
 * type: object
 * properties:
 * name:
 * type: string
 * target_db_host:
 * type: string
 * # ... other topic fields
 * column_mappings:
 * type: array
 * items:
 * # Same item schema as POST
 * type: object
 * responses:
 * 200:
 * description: Topic updated successfully
 * 400:
 * description: Invalid input or validation error
 * 404:
 * description: Topic not found
 */
router.put('/topics/:topicId', adminController.updateTopic);

/**
 * @swagger
 * /api/admin/topics/{topicId}:
 * delete:
 * summary: Delete a topic
 * tags: [Admin - Topic Management]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: topicId
 * required: true
 * schema:
 * type: integer
 * description: The topic ID
 * responses:
 * 200:
 * description: Topic deleted successfully
 * 404:
 * description: Topic not found
 */
router.delete('/topics/:topicId', adminController.deleteTopic);

/**
 * @swagger
 * tags:
 * name: Admin - Permissions Management
 * description: Operations for managing user permissions on topics (Admin access only)
 */

/**
 * @swagger
 * /api/admin/permissions:
 * post:
 * summary: Assign or update permissions for a user on a topic
 * tags: [Admin - Permissions Management]
 * security:
 * - bearerAuth: []
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required: [userId, topicId]
 * properties:
 * userId:
 * type: integer
 * topicId:
 * type: integer
 * can_import:
 * type: boolean
 * can_view_data:
 * type: boolean
 * can_delete_data:
 * type: boolean
 * responses:
 * 200:
 * description: Permission updated successfully
 * 400:
 * description: Missing userId or topicId
 * 404:
 * description: User or Topic not found
 */
router.post('/permissions', adminController.manageUserTopicPermission);

/**
 * @swagger
 * /api/admin/permissions/{userId}/{topicId}:
 * delete:
 * summary: Remove all permissions for a user on a topic
 * tags: [Admin - Permissions Management]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: userId
 * required: true
 * schema:
 * type: integer
 * - in: path
 * name: topicId
 * required: true
 * schema:
 * type: integer
 * responses:
 * 200:
 * description: Permission removed successfully
 * 404:
 * description: Permission not found
 */
router.delete('/permissions/:userId/:topicId', adminController.removeUserTopicPermission);


/**
 * @swagger
 * tags:
 * name: Admin - Log Viewing
 * description: Operations for viewing system and import logs (Admin access only)
 */

/**
 * @swagger
 * /api/admin/logs/system:
 * get:
 * summary: Get system logs
 * tags: [Admin - Log Viewing]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: query
 * name: page
 * schema: { type: integer, default: 1 }
 * - in: query
 * name: limit
 * schema: { type: integer, default: 20 }
 * - in: query
 * name: userId
 * schema: { type: integer }
 * - in: query
 * name: actionType
 * schema: { type: string }
 * - in: query
 * name: status
 * schema: { type: string, enum: [SUCCESS, FAILURE] }
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
 * description: A list of system logs
 */
router.get('/logs/system', adminController.getSystemLogs);

/**
 * @swagger
 * /api/admin/logs/import:
 * get:
 * summary: Get import logs
 * tags: [Admin - Log Viewing]
 * security:
 * - bearerAuth: []
 * parameters:
 * # Similar pagination and filtering parameters as system logs
 * - in: query
 * name: page
 * schema: { type: integer, default: 1 }
 * - in: query
 * name: limit
 * schema: { type: integer, default: 20 }
 * - in: query
 * name: userId
 * schema: { type: integer }
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
 * description: A list of import logs
 */
router.get('/logs/import', adminController.getImportLogs);

module.exports = router;
