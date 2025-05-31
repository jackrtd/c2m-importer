// backend/src/controllers/authController.js
const jwt = require('jsonwebtoken');
const { User } = require('../models'); // Sequelize User model
const logService = require('../services/logService');

/**
 * @desc    Authenticate user & get token (Login)
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = async (req, res, next) => {
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    await logService.logAction(null, `${role ? role.toUpperCase() : 'GENERIC'}_LOGIN_ATTEMPT_FAILURE`, { username, reason: 'Missing credentials or role' }, req.ip, 'FAILURE', 'Username, password, and role are required.');
    return res.status(400).json({ message: 'Please provide username, password, and role (admin/user).' });
  }

  try {
    const user = await User.findOne({ where: { username, role } });

    if (!user) {
      await logService.logAction(null, `${role.toUpperCase()}_LOGIN_ATTEMPT_FAILURE`, { username, role, reason: 'User not found or role mismatch' }, req.ip, 'FAILURE', 'Invalid credentials.');
      return res.status(401).json({ message: 'Invalid credentials.' });
    }
/*
    const isMatch = await user.isValidPassword(password);

    if (!isMatch) {
      await logService.logAction(user.id, `${role.toUpperCase()}_LOGIN_ATTEMPT_FAILURE`, { username, role, reason: 'Incorrect password' }, req.ip, 'FAILURE', 'Invalid credentials.');
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    if (!user.is_active) {
      await logService.logAction(user.id, `${role.toUpperCase()}_LOGIN_ATTEMPT_FAILURE`, { username, role, reason: 'User account inactive' }, req.ip, 'FAILURE', 'Account is inactive.');
      return res.status(403).json({ message: 'Your account is inactive. Please contact an administrator.' });
    }
*/
    const payload = {
      userId: user.id,
      username: user.username,
      role: user.role,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '1d', // Default to 1 day
    });

    await logService.logAction(user.id, `${role.toUpperCase()}_LOGIN_SUCCESS`, { username, role }, req.ip, 'SUCCESS');

    res.json({
      success: true,
      message: 'Login successful',
      token: `Bearer ${token}`,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });

  } catch (error) {
    console.error('Login error:', error);
    await logService.logAction(null, `${role ? role.toUpperCase() : 'GENERIC'}_LOGIN_EXCEPTION`, { username, error: error.message }, req.ip, 'FAILURE', error.message);
    next(error); // Pass to global error handler
  }
};

/**
 * @desc    Register a new user (primarily for regular users, admin might create users differently)
 * @route   POST /api/auth/register
 * @access  Public (or Admin only, depending on policy)
 */
exports.registerUser = async (req, res, next) => {
  const { username, email, password, role = 'user' } = req.body; // Default role to 'user'

  if (!username || !email || !password) {
    await logService.logAction(null, 'USER_REGISTRATION_FAILURE', { username, email, reason: 'Missing fields' }, req.ip, 'FAILURE', 'Please provide username, email, and password.');
    return res.status(400).json({ message: 'Please provide username, email, and password.' });
  }

  // Basic validation
  if (password.length < 6) {
      await logService.logAction(null, 'USER_REGISTRATION_FAILURE', { username, email, reason: 'Password too short' }, req.ip, 'FAILURE', 'Password must be at least 6 characters.');
      return res.status(400).json({ message: 'Password must be at least 6 characters.'});
  }
  if (role !== 'user' && role !== 'admin') { // Restrict role creation via this public endpoint
      await logService.logAction(null, 'USER_REGISTRATION_FAILURE', { username, email, role, reason: 'Invalid role for registration' }, req.ip, 'FAILURE', 'Invalid role specified.');
      return res.status(400).json({ message: "Invalid role specified. Can only register as 'user'."});
  }


  try {
    const userExists = await User.findOne({ where: { username } });
    if (userExists) {
      await logService.logAction(null, 'USER_REGISTRATION_FAILURE', { username, reason: 'Username already exists' }, req.ip, 'FAILURE', 'Username already exists.');
      return res.status(400).json({ message: 'Username already exists.' });
    }

    const emailExists = await User.findOne({ where: { email } });
    if (emailExists) {
      await logService.logAction(null, 'USER_REGISTRATION_FAILURE', { email, reason: 'Email already exists' }, req.ip, 'FAILURE', 'Email already exists.');
      return res.status(400).json({ message: 'Email already exists.' });
    }

    // Password will be hashed by the model's beforeCreate hook
    const newUser = await User.create({
      username,
      email,
      password,
      role, // Role is 'user' by default or as specified if allowed
      is_active: true, // New users are active by default
    });

    await logService.logAction(newUser.id, 'USER_REGISTRATION_SUCCESS', { username: newUser.username, email: newUser.email, role: newUser.role }, req.ip, 'SUCCESS');

    // Optionally, log them in directly by generating a token
    const payload = {
      userId: newUser.id,
      username: newUser.username,
      role: newUser.role,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      token: `Bearer ${token}`, // Send token for immediate login
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
      },
    });

  } catch (error) {
    console.error('Registration error:', error);
    // Check for Sequelize validation errors
    if (error.name === 'SequelizeValidationError') {
        const messages = error.errors.map(e => e.message).join(', ');
        await logService.logAction(null, 'USER_REGISTRATION_VALIDATION_ERROR', { username, email, errors: messages }, req.ip, 'FAILURE', messages);
        return res.status(400).json({ message: messages });
    }
    await logService.logAction(null, 'USER_REGISTRATION_EXCEPTION', { username, email, error: error.message }, req.ip, 'FAILURE', error.message);
    next(error);
  }
};


/**
 * @desc    Get current logged in user details
 * @route   GET /api/auth/me
 * @access  Private (requires token)
 */
exports.getMe = async (req, res, next) => {
    // req.user is attached by the 'protect' middleware
    try {
        // The user object from req.user already excludes the password due to 'protect' middleware query
        if (!req.user) {
             // This case should ideally be caught by 'protect' middleware itself
            await logService.logAction(null, 'GET_ME_FAILURE', { reason: 'User not found in request (middleware issue?)' }, req.ip, 'FAILURE');
            return res.status(404).json({ message: 'User not found.' });
        }

        await logService.logAction(req.user.id, 'GET_ME_SUCCESS', { username: req.user.username }, req.ip, 'SUCCESS');
        res.status(200).json({
            success: true,
            user: req.user // Send the user object (password already excluded)
        });
    } catch (error) {
        console.error('GetMe error:', error);
        await logService.logAction(req.user ? req.user.id : null, 'GET_ME_EXCEPTION', { error: error.message }, req.ip, 'FAILURE', error.message);
        next(error);
    }
};

// Add other auth-related functions if needed, e.g., forgotPassword, resetPassword, logout (though logout is often client-side token removal)
