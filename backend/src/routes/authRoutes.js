// backend/src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware'); // Middleware to protect routes

/**
 * @swagger
 * tags:
 * name: Authentication
 * description: User authentication and registration
 */

/**
 * @swagger
 * /api/auth/login:
 * post:
 * summary: Log in a user or admin
 * tags: [Authentication]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - username
 * - password
 * - role
 * properties:
 * username:
 * type: string
 * example: "testuser"
 * password:
 * type: string
 * example: "password123"
 * role:
 * type: string
 * enum: [user, admin]
 * example: "user"
 * responses:
 * 200:
 * description: Login successful, returns JWT token and user info
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * success:
 * type: boolean
 * example: true
 * message:
 * type: string
 * example: "Login successful"
 * token:
 * type: string
 * example: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 * user:
 * type: object
 * properties:
 * id:
 * type: integer
 * username:
 * type: string
 * email:
 * type: string
 * role:
 * type: string
 * 400:
 * description: Missing credentials or invalid input
 * 401:
 * description: Invalid credentials
 * 403:
 * description: Account inactive
 */
router.post('/login', authController.login);

/**
 * @swagger
 * /api/auth/register:
 * post:
 * summary: Register a new user
 * tags: [Authentication]
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
 * properties:
 * username:
 * type: string
 * example: "newuser"
 * email:
 * type: string
 * format: email
 * example: "newuser@example.com"
 * password:
 * type: string
 * example: "newpassword123"
 * role:
 * type: string
 * enum: [user]
 * description: Optional, defaults to 'user'. Admins are created via admin panel.
 * example: "user"
 * responses:
 * 201:
 * description: User registered successfully, returns JWT token and user info
 * 400:
 * description: Invalid input, user/email already exists, or validation error
 */
router.post('/register', authController.registerUser);

/**
 * @swagger
 * /api/auth/me:
 * get:
 * summary: Get current logged-in user's details
 * tags: [Authentication]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: Successfully retrieved user details
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * success:
 * type: boolean
 * user:
 * $ref: '#/components/schemas/User' # Assuming you have a User schema defined for Swagger
 * 401:
 * description: Not authorized, token failed or no token
 * 404:
 * description: User not found
 */
router.get('/me', protect, authController.getMe); // 'protect' middleware ensures user is authenticated

module.exports = router;

// --- Swagger Components (example, usually in a separate swaggerDef.js) ---
/**
 * @swagger
 * components:
 * schemas:
 * User:
 * type: object
 * properties:
 * id:
 * type: integer
 * description: The user ID.
 * example: 1
 * username:
 * type: string
 * description: The user's username.
 * example: johndoe
 * email:
 * type: string
 * description: The user's email address.
 * example: johndoe@example.com
 * role:
 * type: string
 * enum: [user, admin]
 * description: The user's role.
 * example: user
 * is_active:
 * type: boolean
 * description: Whether the user account is active.
 * example: true
 * created_at:
 * type: string
 * format: date-time
 * description: The date and time the user was created.
 * updated_at:
 * type: string
 * format: date-time
 * description: The date and time the user was last updated.
 * securitySchemes:
 * bearerAuth:
 * type: http
 * scheme: bearer
 * bearerFormat: JWT
 */
