const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Project = require('../models/Project');
const { auth, isAdmin } = require('../middleware/auth');

// Get all projects
router.get('/', auth, async (req, res) => {
    try {
        const query = {};
        
    
        if (req.user.role !== 'admin') {
            query.$or = [
                { team: req.user._id },
                { projectManager: req.user._id }
            ];
        }

        const projects = await Project.find(query)
            .populate('projectManager', 'name email')
            .populate('team', 'name email')
            .sort({ createdAt: -1 });

        res.json(projects);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Create new project
router.post('/', [
    auth,
    isAdmin,
    [
        body('name').trim().notEmpty().withMessage('Project name is required'),
        body('description').trim().notEmpty().withMessage('Description is required'),
        body('client.name').trim().notEmpty().withMessage('Client name is required'),
        body('client.email').isEmail().withMessage('Valid client email is required'),
        body('startDate').isISO8601().withMessage('Valid start date is required'),
        body('endDate').isISO8601().withMessage('Valid end date is required'),
        body('budget').isNumeric().withMessage('Budget must be a number'),
        body('projectManager').notEmpty().withMessage('Project manager is required')
    ]
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const project = new Project(req.body);
        await project.save();
        res.status(201).json(project);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});


router.get('/:id', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id)
            .populate('projectManager', 'name email')
            .populate('team', 'name email');

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Check if user has access to the project
        if (req.user.role !== 'admin' && 
            !project.team.includes(req.user._id) && 
            project.projectManager.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json(project);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Update project
router.put('/:id', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Check if user has permission to update
        if (req.user.role !== 'admin' && 
            !project.team.includes(req.user._id) && 
            project.projectManager.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Update fields
        Object.keys(req.body).forEach(key => {
            project[key] = req.body[key];
        });

        await project.save();
        res.json(project);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete project (Admin only)
router.delete('/:id', [auth, isAdmin], async (req, res) => {
    try {
        const project = await Project.findByIdAndDelete(req.params.id);

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        res.json({ message: 'Project deleted successfully' });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Add team member to project
router.post('/:id/team', [auth, isAdmin], async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        const { userId } = req.body;

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        if (!project.team.includes(userId)) {
            project.team.push(userId);
            await project.save();
        }

        res.json(project);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Remove team member from project
router.delete('/:id/team/:userId', [auth, isAdmin], async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        project.team = project.team.filter(
            memberId => memberId.toString() !== req.params.userId
        );

        await project.save();
        res.json(project);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Add milestone to project
router.post('/:id/milestones', [
    auth,
    [
        body('title').trim().notEmpty().withMessage('Milestone title is required'),
        body('description').trim().notEmpty().withMessage('Description is required'),
        body('dueDate').isISO8601().withMessage('Valid due date is required')
    ]
], async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Check if user has permission to add milestone
        if (req.user.role !== 'admin' && 
            !project.team.includes(req.user._id) && 
            project.projectManager.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }

        project.milestones.push(req.body);
        await project.save();
        res.json(project);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Update milestone status
router.put('/:id/milestones/:milestoneId', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        const milestone = project.milestones.id(req.params.milestoneId);
        if (!milestone) {
            return res.status(404).json({ message: 'Milestone not found' });
        }

        // Check if user has permission to update milestone
        if (req.user.role !== 'admin' && 
            !project.team.includes(req.user._id) && 
            project.projectManager.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }

        milestone.completed = req.body.completed;
        if (req.body.completed) {
            milestone.completedAt = Date.now();
        }

        await project.save();
        res.json(project);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router; 