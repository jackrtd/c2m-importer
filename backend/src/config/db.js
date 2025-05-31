const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

dotenv.config(); // Ensure .env variables are loaded

const sequelize = new Sequelize(
  process.env.SYSTEM_DB_NAME,
  process.env.SYSTEM_DB_USER,
  process.env.SYSTEM_DB_PASSWORD,
  {
    host: process.env.SYSTEM_DB_HOST,
    port: process.env.SYSTEM_DB_PORT || 3306, // Default MySQL port
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false, // Log SQL queries in development
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true, // Automatically add createdAt and updatedAt
      underscored: true, // Use snake_case for automatically added attributes like foreign keys
      // charset: 'utf8mb4', // Recommended for full Unicode support
      // collate: 'utf8mb4_unicode_ci'
    }
  }
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('System MySQL Database connected successfully using Sequelize.');
  } catch (error) {
    console.error('Unable to connect to the system database via Sequelize:', error);
    process.exit(1); // Exit process with failure
  }
};

module.exports = { sequelize, connectDB };