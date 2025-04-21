const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'designer', 'project_manager', 'sales_representative', 'employee'],
        default: 'employee'
    },
    department: {
        type: String,
        enum: ['Design', 'Project Management', 'Sales', 'Administration', 'Other'],
        required: true
    },
    permissions: [{
        type: String,
        enum: ['create_project', 'edit_project', 'delete_project', 'view_all_tasks', 'manage_users', 'view_reports']
    }],
    rewardPoints: {
        type: Number,
        default: 0
    },
    currentStreak: {
        type: Number,
        default: 0
    },
    lastTaskCompletion: {
        type: Date,
        default: null
    },
    rewards: [{
        type: {
            type: String,
            enum: ['points', 'gift'],
            required: true
        },
        value: {
            type: Number,
            required: true
        },
        description: String,
        date: {
            type: Date,
            default: Date.now
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    try {
        if (!this.isModified('password')) {
            return next();
        }
        
        console.log('Hashing password for user:', this.email);
        
        // Check if the password is already hashed (typically a bcrypt hash is 60 chars)
        if (this.password.length < 30) {
            console.log('Password appears to be plaintext, hashing it');
            const salt = await bcrypt.genSalt(10);
            this.password = await bcrypt.hash(this.password, salt);
        } else {
            console.log('Password appears to be already hashed, skipping hash operation');
        }
        
        next();
    } catch (error) {
        console.error('Error in password hashing middleware:', error);
        next(error);
    }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        console.log('Comparing passwords for user:', this.email);
        const isMatch = await bcrypt.compare(candidatePassword, this.password);
        console.log('Password comparison result:', isMatch);
        return isMatch;
    } catch (error) {
        console.error('Error comparing passwords:', error);
        return false;
    }
};

// Method to check if user has specific permission
userSchema.methods.hasPermission = function(permission) {
    return this.permissions.includes(permission);
};

// Method to get user's dashboard route based on role
userSchema.methods.getDashboardRoute = function() {
    switch(this.role) {
        case 'admin':
            return '/admin/dashboard';
        case 'designer':
            return '/design/dashboard';
        case 'project_manager':
            return '/projects/dashboard';
        case 'sales_representative':
            return '/sales/dashboard';
        default:
            return '/tasks';
    }
};

// Method to add reward points
userSchema.methods.addRewardPoints = async function(points, reason) {
    try {
        console.log(`Adding ${points} points to user ${this.email} for: ${reason}`);
        this.rewardPoints += points;
        this.rewards.push({
            type: 'points',
            value: points,
            description: reason,
            date: new Date()
        });
        await this.save();
        console.log(`Successfully added points. New total: ${this.rewardPoints}`);
    } catch (error) {
        console.error('Error adding reward points:', error);
        throw error;
    }
};

// Method to check and update streak
userSchema.methods.updateStreak = async function(taskCompletionDate) {
    try {
        const now = new Date();
        const lastCompletion = this.lastTaskCompletion;
        
        if (!lastCompletion) {
            this.currentStreak = 1;
            console.log(`Starting new streak for user ${this.email}`);
        } else {
            const daysDiff = Math.floor((now - lastCompletion) / (1000 * 60 * 60 * 24));
            if (daysDiff === 1) {
                this.currentStreak += 1;
                console.log(`Continuing streak for user ${this.email}. Current streak: ${this.currentStreak}`);
            } else if (daysDiff > 1) {
                this.currentStreak = 1;
                console.log(`Breaking streak for user ${this.email}. Starting new streak.`);
            }
        }
        
        this.lastTaskCompletion = taskCompletionDate;
        
        // Check for streak rewards
        if (this.currentStreak % 10 === 0) {
            const giftPoints = this.currentStreak * 100; // 100 points for every 10 tasks
            console.log(`User ${this.email} reached ${this.currentStreak} streak! Awarding ${giftPoints} bonus points.`);
            await this.addRewardPoints(giftPoints, `Streak reward for ${this.currentStreak} consecutive tasks`);
        }
        
        await this.save();
        console.log(`Updated streak for user ${this.email}. Current streak: ${this.currentStreak}`);
    } catch (error) {
        console.error('Error updating streak:', error);
        throw error;
    }
};

module.exports = mongoose.model('User', userSchema); 