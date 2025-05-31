const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db'); // Sequelize instance
const bcrypt = require('bcryptjs');

class User extends Model {
  // Instance method to check password
  async isValidPassword(password) {
    return bcrypt.compare(password, this.password);
  }
}

User.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('admin', 'user'),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  // Timestamps (createdAt, updatedAt) are added by default by Sequelize
}, {
  sequelize,
  modelName: 'User',
  tableName: 'Users', // Explicitly define table name
  timestamps: true, // Enable timestamps
  underscored: true, // Use snake_case for createdAt and updatedAt
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
    beforeUpdate: async (user) => {
      // Hash password if it's changed
      if (user.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
  },
});

module.exports = User;