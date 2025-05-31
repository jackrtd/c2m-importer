const jwt = require('jsonwebtoken');
const { User } = require('../models'); // Will be defined later
const logService = require('../services/logService'); // Will be defined later

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach user to request object
      // Select only necessary fields, exclude password
      req.user = await User.findByPk(decoded.userId, {
        attributes: { exclude: ['password'] }
      });

      if (!req.user) {
        // This case might happen if user was deleted after token issuance
        await logService.logAction(decoded.userId, 'AUTH_FAILURE', { reason: 'User not found for token', ip_address: req.ip }, 'FAILURE');
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }
      if (!req.user.is_active) {
        await logService.logAction(req.user.id, 'AUTH_FAILURE', { reason: 'User account inactive', ip_address: req.ip }, 'FAILURE');
        return res.status(403).json({ message: 'Account is inactive. Please contact administrator.' });
      }

      next();
    } catch (error) {
      console.error('JWT Error:', error.message);
      await logService.logAction(null, 'AUTH_FAILURE', { reason: `Token failed verification: ${error.message}`, ip_address: req.ip }, 'FAILURE');
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    await logService.logAction(null, 'AUTH_FAILURE', { reason: 'No token provided', ip_address: req.ip }, 'FAILURE');
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      const userIdForLog = req.user ? req.user.id : null;
      const details = {
        required_roles: roles,
        user_role: req.user ? req.user.role : 'N/A',
        resource: `${req.method} ${req.originalUrl}`,
        ip_address: req.ip
      };
      logService.logAction(userIdForLog, 'AUTHORIZATION_FAILURE', details, 'FAILURE');
      return res.status(403).json({ message: `User role '${req.user ? req.user.role : 'guest'}' is not authorized to access this route` });
    }
    next();
  };
};

module.exports = { protect, authorize };