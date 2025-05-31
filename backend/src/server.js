// backend/src/server.js
console.log("Server.js: Script starting..."); // Initial log

require('dotenv').config(); 
console.log("Server.js: dotenv configured.");

const express = require('express');
const cors = require('cors');
const morgan = require('morgan'); 
const path = require('path');
console.log("Server.js: Core modules (express, cors, morgan, path) required.");

// --- Database & Models ---
console.log("Server.js: Requiring database config (db.js)...");
const { sequelize, connectDB } = require('./config/db');
console.log("Server.js: Database config required.");

console.log("Server.js: Requiring models (models/index.js)...");
require('./models'); 
console.log("Server.js: Models required and associations should be defined.");

console.log("Server.js: Requiring initialSetup utility...");
const { createInitialAdmin } = require('./utils/initialSetup');
console.log("Server.js: initialSetup utility required.");

// --- Routes ---
console.log("Server.js: Requiring route modules...");
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userRoutes = require('./routes/userRoutes');
const importRoutes = require('./routes/importRoutes');
console.log("Server.js: Route modules required.");

// --- Middleware ---
console.log("Server.js: Requiring middleware modules...");
const errorHandler = require('./middleware/errorHandler');
// const { protect } = require('./middleware/authMiddleware'); // Not directly used in server.js app.use, but by routes
console.log("Server.js: Middleware modules required.");

const app = express();
const PORT = process.env.PORT || 3000;
console.log(`Server.js: Express app created. PORT set to ${PORT}.`);

// --- Core Middleware ---
console.log("Server.js: Applying core middleware (cors, express.json, express.urlencoded, morgan)...");
app.use(cors()); 
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ extended: true, limit: '50mb' })); 
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev')); 
}
console.log("Server.js: Core middleware applied.");

// --- API Routes ---
console.log("Server.js: Registering API routes...");
app.get('/api', (req, res) => {
  res.json({ message: 'Welcome to Data Import System API v1.0' });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes); 
app.use('/api/user', userRoutes);   
app.use('/api/import', importRoutes); 
console.log("Server.js: API routes registered.");

// --- Global Error Handler ---
console.log("Server.js: Registering global error handler...");
app.use(errorHandler);
console.log("Server.js: Global error handler registered.");


// --- Server Initialization and Database Connection ---
const startServer = async () => {
  console.log("Server.js: startServer function invoked.");
  try {
    console.log("Server.js: Attempting to connect to database (connectDB)...");
    await connectDB(); 
    console.log("Server.js: connectDB successful.");

    console.log("Server.js: Attempting to synchronize Sequelize models (sequelize.sync)...");
    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' }); 
    console.log('Server.js: All models were synchronized successfully with the system database.');

    console.log("Server.js: Attempting to create initial admin (createInitialAdmin)...");
    await createInitialAdmin();
    console.log("Server.js: createInitialAdmin completed.");

    app.listen(PORT, () => {
      console.log("=================================================================");
      console.log(`Backend server IS RUNNING on http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
      console.log("=================================================================");
    });
  } catch (error) {
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.error('Server.js: FAILED TO START SERVER OR CONNECT TO DATABASE:');
    console.error(error); // Log the full error object
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    process.exit(1); 
  }
};

console.log("Server.js: Attempting to call startServer()...");
startServer();
