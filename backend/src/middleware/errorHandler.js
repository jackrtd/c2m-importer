const logService = require('../services/logService'); // Will be defined later

const errorHandler = (err, req, res, next) => {
  console.error('ERROR STACK:', err.stack); // Log the full error stack for debugging

  const statusCode = err.statusCode || res.statusCode === 200 ? 500 : res.statusCode;
  const message = err.message || 'Internal Server Error';

  // Log the error using the logService
  const userIdForLog = req.user ? req.user.id : null;
  logService.logAction(
    userIdForLog,
    'SYSTEM_ERROR',
    {
      error: message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined, // Only include stack in dev
      path: req.originalUrl,
      method: req.method,
      ip_address: req.ip
    },
    'FAILURE'
  ).catch(logErr => console.error("Failed to log system error:", logErr)); // Catch logging errors

  res.status(statusCode).json({
    message: message,
    // Include stack trace in development for easier debugging
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};

module.exports = errorHandler;