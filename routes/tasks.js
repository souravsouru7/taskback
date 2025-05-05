const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const Project = require('../models/Project');
const User = require('../models/User');
const { auth, isAdmin } = require('../middleware/auth');
const Notification = require('../models/Notification');

// Create a new task (Admin only)
router.post('/', auth, isAdmin, async (req, res) => {
    try {
        console.log('Creating task with body:', req.body);
        console.log('Current user from middleware:', req.user);
        
        const { title, description, project, assignedTo, priority, dueDate, status, createdBy } = req.body;

        // Validate project exists
        const projectExists = await Project.findById(project);
        if (!projectExists) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Validate assigned user exists if provided
        if (assignedTo) {
            const userExists = await User.findById(assignedTo);
            if (!userExists) {
                return res.status(404).json({ message: 'Assigned user not found' });
            }
        }

        // Determine the creator ID - priority to token user if no createdBy provided
        let taskCreator;
        
        if (createdBy) {
            // If createdBy is provided in request, validate it refers to a real user
            const creatorExists = await User.findById(createdBy);
            if (creatorExists) {
                taskCreator = createdBy;
                console.log('Using provided creator ID:', taskCreator);
            } else {
                console.log('Provided createdBy is invalid, falling back to authenticated user');
                taskCreator = req.user._id;
            }
        } else {
            // Default to the authenticated user
            taskCreator = req.user._id;
            console.log('No createdBy provided, using authenticated user:', taskCreator);
        }
        
        // Ensure we have a creator ID before attempting to create the task
        if (!taskCreator) {
            console.error('Failed to determine task creator');
            return res.status(400).json({ message: 'Could not determine task creator' });
        }

        const task = new Task({
            title,
            description,
            project,
            assignedTo,
            priority,
            dueDate,
            createdBy: taskCreator,
            status: status || 'pending'
        });

        console.log('Task object before saving:', task);
        
        const savedTask = await task.save();
        console.log('Task created successfully:', savedTask._id);
        res.status(201).json(savedTask);
    } catch (error) {
        console.error('Error creating task:', error);
        
        // Better error message for validation errors
        if (error.name === 'ValidationError') {
            const validationErrors = {};
            
            // Extract specific validation error messages
            for (const field in error.errors) {
                validationErrors[field] = error.errors[field].message;
            }
            
            return res.status(400).json({ 
                message: 'Validation error', 
                errors: validationErrors,
                details: error.message
            });
        }
        
        res.status(500).json({ message: error.message });
    }
});

// Get all tasks
router.get('/', auth, async (req, res) => {
    try {
        const tasks = await Task.find()
            .populate('project', 'name')
            .populate('assignedTo', 'name')
            .populate('createdBy', 'name');
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get tasks assigned to the current user - IMPORTANT: This route must be defined BEFORE /:id route
router.get('/assigned-to-me', auth, async (req, res) => {
    try {
        console.log('Getting tasks for user ID:', req.user._id);
        
        const tasks = await Task.find({ assignedTo: req.user._id })
            .populate('project', 'name')
            .populate('assignedTo', 'name')
            .populate('createdBy', 'name');
        
        console.log(`Found ${tasks.length} tasks assigned to user ${req.user._id}`);
        res.json(tasks);
    } catch (error) {
        console.error('Error getting assigned tasks:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get task by ID
router.get('/:id', auth, async (req, res) => {
    try {
        const task = await Task.findById(req.params.id)
            .populate('project', 'name')
            .populate('assignedTo', 'name')
            .populate('createdBy', 'name')
            .populate('comments.postedBy', 'name');
        
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }
        
        res.json(task);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update task (Admin only)
router.put('/:id', auth, isAdmin, async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        const updates = Object.keys(req.body);
        updates.forEach(update => task[update] = req.body[update]);
        
        await task.save();
        res.json(task);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete task (Admin only)
router.delete('/:id', auth, isAdmin, async (req, res) => {
    try {
        const task = await Task.findByIdAndDelete(req.params.id);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }
        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Add comment to task
router.post('/:id/comments', auth, async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // Add the comment
        task.comments.push({
            text: req.body.text,
            postedBy: req.user._id
        });

        await task.save();

        // Create notifications for:
        // 1. The task creator
        // 2. The assigned user
        // 3. Admin users
        const notificationPromises = [];

        // Get the current user's name
        const currentUser = await User.findById(req.user._id);
        const commenterName = currentUser ? currentUser.name : 'unknown';

        // Notify task creator if not the commenter
        if (task.createdBy.toString() !== req.user._id.toString()) {
            notificationPromises.push(
                Notification.create({
                    recipient: task.createdBy,
                    task: task._id,
                    type: 'comment',
                    actor: req.user._id,
                    message: `New comment on task "${task.title}" by ${commenterName}`
                })
            );
        }

        // Notify assigned user if not the commenter
        if (task.assignedTo.toString() !== req.user._id.toString()) {
            notificationPromises.push(
                Notification.create({
                    recipient: task.assignedTo,
                    task: task._id,
                    type: 'comment',
                    actor: req.user._id,
                    message: `New comment on task "${task.title}" by ${commenterName}`
                })
            );
        }

        // Notify admin users only if they are not the task creator or assigned user
        const adminUsers = await User.find({ role: 'admin' });
        adminUsers.forEach(admin => {
            // Skip if admin is the commenter, task creator, or assigned user
            if (admin._id.toString() !== req.user._id.toString() &&
                admin._id.toString() !== task.createdBy.toString() &&
                admin._id.toString() !== task.assignedTo.toString()) {
                notificationPromises.push(
                    Notification.create({
                        recipient: admin._id,
                        task: task._id,
                        type: 'comment',
                        actor: req.user._id,
                        message: `New comment on task "${task.title}" by ${commenterName}`
                    })
                );
            }
        });

        await Promise.all(notificationPromises);

        res.json(task);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update task status (available to assigned user)
router.patch('/:id/status', auth, async (req, res) => {
    try {
        const { status } = req.body;
        if (!status) {
            return res.status(400).json({ message: 'Status is required' });
        }
        
        // Validate status value
        const validStatuses = ['pending', 'in_progress', 'completed', 'overdue'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                message: 'Invalid status value. Must be one of: pending, in_progress, completed, overdue' 
            });
        }
        
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }
        
        // Check if the user is assigned to this task or is an admin
        const isAssigned = task.assignedTo && task.assignedTo.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin';
        
        if (!isAssigned && !isAdmin) {
            return res.status(403).json({ 
                message: 'You are not authorized to update this task status' 
            });
        }
        
        console.log(`Updating task ${task._id} status from ${task.status} to ${status} by user ${req.user._id}`);
        
        // Update status
        task.status = status;
        
        let rewardInfo = null;
        
        // If task is being completed, handle rewards
        if (status === 'completed') {
            const completedTask = await task.completeTask();
            // Get updated user info to include reward points
            const user = await User.findById(task.assignedTo);
            if (user) {
                rewardInfo = {
                    pointsEarned: completedTask.rewardPoints,
                    totalPoints: user.rewardPoints,
                    currentStreak: user.currentStreak,
                    isCompletedOnTime: completedTask.isCompletedOnTime
                };
            }
        } else {
            await task.save();
        }
        
        // Return the updated task with populated fields and reward info
        const updatedTask = await Task.findById(req.params.id)
            .populate('project', 'name')
            .populate('assignedTo', 'name')
            .populate('createdBy', 'name')
            .populate('comments.postedBy', 'name');
            
        res.json({
            task: updatedTask,
            rewardInfo
        });
    } catch (error) {
        console.error('Error updating task status:', error);
        res.status(500).json({ message: 'Error updating task status', error: error.message });
    }
});

// Get user's reward points and streak
router.get('/rewards/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        res.json({
            rewardPoints: user.rewardPoints,
            currentStreak: user.currentStreak,
            rewards: user.rewards
        });
    } catch (error) {
        console.error('Error fetching rewards:', error);
        res.status(500).json({ message: 'Error fetching rewards', error: error.message });
    }
});

// Get leaderboard of users by reward points
router.get('/rewards/leaderboard', auth, async (req, res) => {
    try {
        const users = await User.find({ role: { $ne: 'admin' } }) // Exclude admin users
            .select('name email rewardPoints currentStreak')
            .sort({ rewardPoints: -1 })
            .limit(10);
            
        res.json(users);
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ message: 'Error fetching leaderboard', error: error.message });
    }
});

// Request task extension
router.post('/:id/extension-request', auth, async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // Check if user is assigned to this task
        if (task.assignedTo.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'You are not assigned to this task' });
        }

        const { reason, newDueDate } = req.body;

        if (!reason || !newDueDate) {
            return res.status(400).json({ message: 'Reason and new due date are required' });
        }

        // Validate new due date is after current due date
        const proposedDate = new Date(newDueDate);
        if (proposedDate <= task.dueDate) {
            return res.status(400).json({ message: 'New due date must be after current due date' });
        }

        task.extensionRequest = {
            requested: true,
            status: 'pending',
            requestedBy: req.user._id,
            requestedAt: new Date(),
            reason,
            newDueDate: proposedDate
        };

        await task.save();

        // Create notification for admin
        const notification = new Notification({
            recipient: task.createdBy, // Assuming admin is the task creator
            task: task._id,
            type: 'extension_request',
            message: `Extension requested for task: ${task.title}`,
            actor: req.user._id
        });

        await notification.save();

        res.json({ message: 'Extension request submitted successfully', task });
    } catch (error) {
        console.error('Error requesting extension:', error);
        res.status(500).json({ message: 'Error requesting extension', error: error.message });
    }
});

// Handle extension request (Admin only)
router.patch('/:id/extension-request', auth, isAdmin, async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        if (!task.extensionRequest.requested) {
            return res.status(400).json({ message: 'No extension request found for this task' });
        }

        const { status, newDueDate } = req.body;

        if (!status || !['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Valid status (approved/rejected) is required' });
        }

        if (status === 'approved' && !newDueDate) {
            return res.status(400).json({ message: 'New due date is required when approving extension' });
        }

        if (status === 'approved') {
            const proposedDate = new Date(newDueDate);
            if (proposedDate <= task.dueDate) {
                return res.status(400).json({ message: 'New due date must be after current due date' });
            }

            task.dueDate = proposedDate;
            task.extensionRequest.status = 'approved';
            task.extensionRequest.approvedBy = req.user._id;
            task.extensionRequest.approvedAt = new Date();
            task.extensionRequest.newDueDate = proposedDate;
        } else {
            task.extensionRequest.status = 'rejected';
            task.extensionRequest.approvedBy = req.user._id;
            task.extensionRequest.approvedAt = new Date();
        }

        await task.save();

        // Create notification for the assigned user
        const notification = new Notification({
            recipient: task.assignedTo,
            task: task._id,
            type: 'extension_response',
            message: `Your extension request for task "${task.title}" has been ${status}`,
            actor: req.user._id
        });

        await notification.save();

        res.json({ 
            message: `Extension request ${status} successfully`,
            task 
        });
    } catch (error) {
        console.error('Error handling extension request:', error);
        res.status(500).json({ message: 'Error handling extension request', error: error.message });
    }
});

// Get extension request status
router.get('/:id/extension-request', auth, async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // Check if user is assigned to this task or is admin
        if (task.assignedTo.toString() !== req.user._id.toString() && 
            task.createdBy.toString() !== req.user._id.toString() &&
            req.user.role !== 'admin') {
            return res.status(403).json({ message: 'You are not authorized to view this extension request' });
        }

        res.json({ extensionRequest: task.extensionRequest });
    } catch (error) {
        console.error('Error fetching extension request:', error);
        res.status(500).json({ message: 'Error fetching extension request', error: error.message });
    }
});

module.exports = router; 