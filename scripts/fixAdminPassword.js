const mongoose = require('mongoose');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const fixAdminPassword = async () => {
  try {
    // Check for JWT_SECRET
    if (!process.env.JWT_SECRET) {
      console.log('Warning: JWT_SECRET is not set in environment variables');
      // Setting a default for development
      process.env.JWT_SECRET = 'developmentsecret';
      console.log('Set default JWT_SECRET for development');
    }

    await mongoose.connect('mongodb://localhost:27017/tasksouru', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Find admin user
    const admin = await User.findOne({ email: 'admin@example.com' });
    if (!admin) {
      console.log('Admin user not found. Please run createAdmin.js first.');
      process.exit(1);
    }

    console.log('Found admin user:', admin.email);
    
    // Generate new password hash directly
    const plainPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    
    // Update password directly in database
    const result = await User.updateOne(
      { email: 'admin@example.com' },
      { $set: { password: hashedPassword } }
    );
    
    console.log('Password update result:', result);
    console.log('Admin password has been reset to "admin123"');
    
    // Verify by loading the user again and testing password
    const updatedAdmin = await User.findOne({ email: 'admin@example.com' });
    const isMatch = await bcrypt.compare(plainPassword, updatedAdmin.password);
    console.log('Password verification after direct update:', isMatch ? 'SUCCESS' : 'FAILED');
    
    process.exit(0);
  } catch (error) {
    console.error('Error fixing admin password:', error);
    process.exit(1);
  }
};

fixAdminPassword(); 