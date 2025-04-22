const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Project = require('../models/Project');
const { auth, isAdmin } = require('../middleware/auth');
const Task = require('../models/Task');

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

// Get specific project by ID with detailed information
router.get('/:id', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id)
            .populate('projectManager', 'name email role department')
            .populate('team', 'name email role department')
            .populate({
                path: 'documents.uploadedBy',
                select: 'name email'
            });

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Check if user has access to the project
        if (req.user.role !== 'admin' && 
            !project.team.some(member => member._id.toString() === req.user._id.toString()) && 
            project.projectManager._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Get project statistics
        const taskCount = await Task.countDocuments({ project: project._id });
        const completedTasks = await Task.countDocuments({ 
            project: project._id, 
            status: 'completed' 
        });
        const overdueTasks = await Task.countDocuments({ 
            project: project._id, 
            status: 'overdue' 
        });

        const projectWithStats = {
            ...project.toObject(),
            statistics: {
                totalTasks: taskCount,
                completedTasks,
                overdueTasks,
                completionRate: taskCount > 0 ? (completedTasks / taskCount) * 100 : 0
            }
        };

        res.json(projectWithStats);
    } catch (error) {
        console.error('Error fetching project:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Update project with validation
router.put('/:id', [
    auth,
    [
        body('name').optional().trim().notEmpty().withMessage('Project name cannot be empty'),
        body('description').optional().trim().notEmpty().withMessage('Description cannot be empty'),
        body('client.name').optional().trim().notEmpty().withMessage('Client name cannot be empty'),
        body('client.email').optional().isEmail().withMessage('Valid client email is required'),
        body('startDate').optional().isISO8601().withMessage('Valid start date is required'),
        body('endDate').optional().isISO8601().withMessage('Valid end date is required'),
        body('budget').optional().isNumeric().withMessage('Budget must be a number'),
        body('status').optional().isIn(['planning', 'in-progress', 'review', 'completed', 'on-hold']).withMessage('Invalid status')
    ]
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Check if user has permission to update
        if (req.user.role !== 'admin' && 
            !project.team.some(member => member._id.toString() === req.user._id.toString()) && 
            project.projectManager._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Update fields
        const updates = Object.keys(req.body);
        const allowedUpdates = ['name', 'description', 'client', 'startDate', 'endDate', 'budget', 'status'];
        const isValidOperation = updates.every(update => allowedUpdates.includes(update));

        if (!isValidOperation) {
            return res.status(400).json({ message: 'Invalid updates' });
        }

        updates.forEach(update => {
            if (update === 'client') {
                project.client = { ...project.client, ...req.body.client };
            } else {
                project[update] = req.body[update];
            }
        });

        await project.save();
        res.json(project);
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Delete project with cleanup
router.delete('/:id', [auth, isAdmin], async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Delete all tasks associated with the project
        await Task.deleteMany({ project: project._id });

        // Delete the project using deleteOne
        await Project.deleteOne({ _id: project._id });

        res.json({ 
            message: 'Project and associated tasks deleted successfully',
            deletedProjectId: project._id
        });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
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