const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth, isAdmin } = require('../middleware/auth');

// Get all users (Admin only)
router.get('/', [auth, isAdmin], async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Create new user (Admin only)
router.post('/', [
    auth,
    isAdmin,
    [
        body('name').trim().notEmpty().withMessage('Name is required'),
        body('email').isEmail().withMessage('Please enter a valid email'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
        body('role').isIn(['admin', 'designer', 'project_manager', 'sales_representative', 'employee']).withMessage('Invalid role'),
        body('department').isIn(['Design', 'Project Management', 'Sales', 'Administration', 'Other']).withMessage('Invalid department')
    ]
], async (req, res) => {
    try {
        console.log('Received user creation request:', req.body);
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Validation errors:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, email, password, role, department } = req.body;

        // Check if user already exists
        let user = await User.findOne({ email });
        if (user) {
            console.log('User already exists with email:', email);
            return res.status(400).json({ message: 'User already exists' });
        }

        // Create new user with role-specific permissions
        user = new User({
            name,
            email,
            password,
            role,
            department,
            permissions: getDefaultPermissions(role)
        });

        console.log('Attempting to save new user:', {
            name,
            email,
            role,
            department,
            permissions: getDefaultPermissions(role)
        });

        await user.save();
        console.log('User saved successfully:', user._id);

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department,
            permissions: user.permissions
        });
    } catch (error) {
        console.error('User creation error:', error);
        res.status(500).json({ message: 'Server error', details: error.message });
    }
});

// Get user by ID (Admin or self)
router.get('/:id', auth, async (req, res) => {
    try {
        // Check if user has permission to view
        if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.id) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Update user (Admin or self)
router.put('/:id', [
    auth,
    [
        body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
        body('email').optional().isEmail().withMessage('Please enter a valid email'),
        body('department').optional().trim().notEmpty().withMessage('Department cannot be empty'),
        body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
    ]
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        // Check if user has permission to update
        if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.id) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update fields
        Object.keys(req.body).forEach(key => {
            if (key !== 'role') { // Prevent role update through this route
                user[key] = req.body[key];
            }
        });

        await user.save();
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Update user role (Admin only)
router.put('/:id/role', [
    auth,
    isAdmin,
    body('role').isIn(['admin', 'designer', 'project_manager', 'sales_representative', 'employee']).withMessage('Invalid role')
], async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.role = req.body.role;
        user.permissions = getDefaultPermissions(req.body.role);
        await user.save();
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete user (Admin only)
router.delete('/:id', [auth, isAdmin], async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get user's tasks
router.get('/:id/tasks', auth, async (req, res) => {
    try {
        // Check if user has permission to view tasks
        if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.id) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const tasks = await Task.find({ assignedTo: req.params.id })
            .populate('project', 'name')
            .populate('assignedBy', 'name email')
            .sort({ createdAt: -1 });

        res.json(tasks);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get user's projects
router.get('/:id/projects', auth, async (req, res) => {
    try {
        // Check if user has permission to view projects
        if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.id) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const projects = await Project.find({
            $or: [
                { team: req.params.id },
                { projectManager: req.params.id }
            ]
        })
        .populate('projectManager', 'name email')
        .populate('team', 'name email')
        .sort({ createdAt: -1 });

        res.json(projects);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get user profile (Admin or self)
router.get('/profile/:id', auth, async (req, res) => {
    try {
        // Check if user has permission to view
        if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.id) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Prepare profile data based on role
        const profileData = {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department,
            rewardPoints: user.rewardPoints,
            currentStreak: user.currentStreak,
            createdAt: user.createdAt
        };

        // Add additional data for admin users
        if (req.user.role === 'admin') {
            profileData.permissions = user.permissions;
            profileData.rewards = user.rewards;
            profileData.lastTaskCompletion = user.lastTaskCompletion;
        }

        res.json(profileData);
    } catch (error) {
        console.error('Error fetching user profile:', error);
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