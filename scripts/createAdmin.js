const mongoose = require('mongoose');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const createAdmin = async () => {
  try {
    // Check for JWT_SECRET
    if (!process.env.JWT_SECRET) {
      console.log('Warning: JWT_SECRET is not set in environment variables');
      // Setting a default for development
      process.env.JWT_SECRET = 'developmentsecret';
      console.log('Set default JWT_SECRET for development');
    }

    // Check for MongoDB URI
    if (!process.env.MONGODB_URI) {
      console.error('Error: MONGODB_URI is not set in environment variables');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Generate new password hash
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const existingAdmin = await User.findOne({ email: 'tam@gmail.com' });
    if (existingAdmin) {
      console.log('Admin user already exists');
      console.log('Updating admin user with correct permissions, role, and resetting password...');
      
      // Update the existing admin with proper permissions and role
      existingAdmin.role = 'admin';
      existingAdmin.department = 'Administration';
      existingAdmin.permissions = [
        'create_project', 
        'edit_project', 
        'delete_project', 
        'view_all_tasks', 
        'manage_users', 
        'view_reports'
      ];
      
      // Reset password to ensure it works
      existingAdmin.password = hashedPassword;
      
      await existingAdmin.save();
      console.log('Admin user updated successfully');
      
      // Test password comparison
      const passwordMatch = await existingAdmin.comparePassword('admin123');
      console.log('Password verification:', passwordMatch ? 'SUCCESS' : 'FAILED');
      
      process.exit(0);
    }

    const adminUser = new User({
      name: 'Admin User',
      email: 'admin@example.com',
      password: hashedPassword,
      role: 'admin',
      department: 'Administration',
      permissions: [
        'create_project', 
        'edit_project', 
        'delete_project', 
        'view_all_tasks', 
        'manage_users', 
        'view_reports'
      ]
    });

    await adminUser.save();
    console.log('Admin user created successfully');
    
    // Verify the user can be retrieved 
    const savedAdmin = await User.findOne({ email: 'admin@example.com' });
    if (savedAdmin) {
      console.log('Admin user verified in database');
      // Test password comparison
      const passwordMatch = await savedAdmin.comparePassword('admin123');
      console.log('Password verification:', passwordMatch ? 'SUCCESS' : 'FAILED');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
};

createAdmin();