const bcrypt = require('bcryptjs');
const { User } = require('../models'); // Models will be defined later

const createInitialAdmin = async () => {
  try {
    const adminUsername = process.env.INITIAL_ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'adminpassword';

    if (!adminUsername || !adminPassword) {
      console.warn('Initial admin credentials not set in .env. Skipping admin creation.');
      return;
    }

    const existingAdmin = await User.findOne({ where: { username: adminUsername, role: 'admin' } });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      await User.create({
        username: adminUsername,
        password: hashedPassword,
        role: 'admin',
        email: `${adminUsername}@example.com`, // Placeholder email
        is_active: true,
      });
      console.log('Initial admin user created successfully.');
    } else {
      console.log('Initial admin user already exists.');
    }
  } catch (error) {
    console.error('Error creating initial admin user:', error);
  }
};

// You could add functions to create initial roles if you had a separate Roles table
// const createInitialRoles = async () => { ... };
module.exports = { createInitialAdmin };