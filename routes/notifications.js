const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

// Get all notifications for the current user
router.get('/', auth, async (req, res) => {
    try {
        const notifications = await Notification.find({ recipient: req.user._id })
            .sort({ createdAt: -1 })
            .populate('task', 'title')
            .populate('recipient', 'name email')
            .populate('actor', 'name email');

        if (!notifications) {
            return res.status(404).json({ message: 'No notifications found' });
        }

        // Format notifications with proper names
        const formattedNotifications = await Promise.all(notifications.map(async (notification) => {
            // Ensure we have the actor's name
            let actorName = 'unknown';
            if (notification.actor) {
                const actor = await User.findById(notification.actor._id);
                actorName = actor ? actor.name : 'unknown';
            }

            return {
                ...notification.toObject(),
                message: notification.message.replace('unknown', actorName)
            };
        }));

        res.json(formattedNotifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ 
            message: 'Error fetching notifications',
            error: error.message 
        });
    }
});

// Mark notification as read
router.patch('/:id/read', auth, async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id)
            .populate('actor', 'name email');

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        // Check if the user is the recipient
        if (notification.recipient.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to mark this notification as read' });
        }

        notification.isRead = true;
        await notification.save();

        // Get the actor's name
        let actorName = 'unknown';
        if (notification.actor) {
            const actor = await User.findById(notification.actor._id);
            actorName = actor ? actor.name : 'unknown';
        }

        // Format the response with proper name
        const formattedNotification = {
            ...notification.toObject(),
            message: notification.message.replace('unknown', actorName)
        };

        res.json(formattedNotification);
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ 
            message: 'Error marking notification as read',
            error: error.message 
        });
    }
});

// Mark all notifications as read
router.patch('/read-all', auth, async (req, res) => {
    try {
        const result = await Notification.updateMany(
            { recipient: req.user._id, isRead: false },
            { $set: { isRead: true } }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ message: 'No unread notifications found' });
        }

        res.json({ 
            message: 'All notifications marked as read',
            modifiedCount: result.modifiedCount 
        });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ 
            message: 'Error marking all notifications as read',
            error: error.message 
        });
    }
});

// Get unread notification count
router.get('/unread/count', auth, async (req, res) => {
    try {
        const count = await Notification.countDocuments({
            recipient: req.user._id,
            isRead: false
        });

        res.json({ count });
    } catch (error) {
        console.error('Error getting unread notification count:', error);
        res.status(500).json({ 
            message: 'Error getting unread notification count',
            error: error.message 
        });
    }
});

module.exports = router; 