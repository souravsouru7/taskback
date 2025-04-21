const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth, isAdmin, hasPermission } = require('../middleware/auth');

// Register new user (Admin only)
router.post('/register', [
    auth,
    isAdmin,
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    body('role').isIn(['admin', 'designer', 'project_manager', 'sales_representative', 'employee']).withMessage('Invalid role'),
    body('department').isIn(['Design', 'Project Management', 'Sales', 'Administration', 'Other']).withMessage('Invalid department')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, email, password, role, department } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        // Check if user already exists
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Create new user with role-specific permissions
        user = new User({
            name,
            email,
            password: hashedPassword,
            role,
            department,
            permissions: getDefaultPermissions(role)
        });

        await user.save();

        // Create JWT token
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                department: user.department,
                permissions: user.permissions
            },
            token
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Public registration (no authentication required)
router.post('/register/public', [
    [
        body('name').trim().notEmpty().withMessage('Name is required'),
        body('email').isEmail().withMessage('Please enter a valid email'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
        body('department').trim().notEmpty().withMessage('Department is required')
    ]
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, email, password, department } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        // Check if user already exists
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Create new user with employee role
        user = new User({
            name,
            email,
            password: hashedPassword,
            role: 'employee', // Automatically set as employee
            department
        });

        await user.save();

        res.status(201).json({
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                department: user.department
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Login user
router.post('/login', [
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').exists().withMessage('Password is required')
], async (req, res) => {
    try {
        console.log('Login attempt received:', req.body.email);
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Validation errors:', errors.array());
            return res.status(400).json({ message: errors.array()[0].msg });
        }

        const { email, password } = req.body;

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            console.log('User not found:', email);
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        console.log('User found:', user.email);
        
        // Check password
        const isMatch = await user.comparePassword(password);
        console.log('Password match:', isMatch);
        
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        // Check if user has permissions
        if (!user.permissions || user.permissions.length === 0) {
            console.log('User has no permissions. Adding default permissions.');
            // Assign default permissions based on role
            user.permissions = getDefaultPermissions(user.role);
            await user.save();
        }

        // Create JWT token
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET || 'developmentsecret',
            { expiresIn: '24h' }
        );

        console.log('Login successful:', user.email, 'Role:', user.role);
        
        // Determine dashboard route
        let dashboardRoute = '/tasks';
        if (user.role === 'admin') {
            dashboardRoute = '/admin-dashboard';
        }

        res.json({
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                department: user.department,
                permissions: user.permissions
            },
            token,
            dashboardRoute
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login. Please try again.' });
    }
});

// Get current user
router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        res.json(user);
    } catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Helper function to get default permissions based on role
function getDefaultPermissions(role) {
    switch (role) {
        case 'admin':
            return ['create_project', 'edit_project', 'delete_project', 'view_all_tasks', 'manage_users', 'view_reports'];
        case 'designer':
            return ['create_project', 'edit_project', 'view_all_tasks'];
        case 'project_manager':
            return ['create_project', 'edit_project', 'view_all_tasks', 'view_reports'];
        case 'sales_representative':
            return ['view_all_tasks', 'view_reports'];
        default:
            return ['view_all_tasks'];
    }
}

module.exports = router;