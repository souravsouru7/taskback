const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'overdue'],
        default: 'pending'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    dueDate: {
        type: Date,
        required: true
    },
    completionDate: {
        type: Date,
        default: null
    },
    isCompletedOnTime: {
        type: Boolean,
        default: false
    },
    rewardPoints: {
        type: Number,
        default: 0
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    extensionRequest: {
        requested: {
            type: Boolean,
            default: false
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending'
        },
        requestedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        requestedAt: {
            type: Date
        },
        reason: {
            type: String
        },
        newDueDate: {
            type: Date
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        approvedAt: {
            type: Date
        }
    },
    comments: [{
        text: String,
        postedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    attachments: [{
        name: String,
        url: String,
        type: String,
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update the updatedAt timestamp before saving
taskSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Method to complete task and handle rewards
taskSchema.methods.completeTask = async function() {
    try {
        const now = new Date();
        this.status = 'completed';
        this.completionDate = now;
        
        // Check if task was completed on time (before or on due date)
        const dueDate = new Date(this.dueDate);
        dueDate.setHours(23, 59, 59, 999); // Set to end of day for fair comparison
        
        this.isCompletedOnTime = now <= dueDate;
        
        // Only award points if completed on time
        if (this.isCompletedOnTime) {
            // Base points for on-time completion
            this.rewardPoints = 50;
            console.log(`Task ${this._id} completed on time. Awarding ${this.rewardPoints} points.`);
        } else {
            this.rewardPoints = 0;
            console.log(`Task ${this._id} completed late. No points awarded.`);
        }
        
        // Save task first
        await this.save();
        console.log('Task saved successfully');
        
        // Update user's streak and reward points
        const User = mongoose.model('User');
        const user = await User.findById(this.assignedTo);
        
        if (user) {
            console.log(`Updating rewards for user ${user.email}`);
            if (this.isCompletedOnTime) {
                await user.updateStreak(now);
                await user.addRewardPoints(this.rewardPoints, `On-time task completion: ${this.title}`);
                console.log(`Added ${this.rewardPoints} points to user ${user.email}`);
            }
        } else {
            console.error(`User ${this.assignedTo} not found for task ${this._id}`);
        }
        
        return this;
    } catch (error) {
        console.error('Error in completeTask:', error);
        throw error;
    }
};

module.exports = mongoose.model('Task', taskSchema); 