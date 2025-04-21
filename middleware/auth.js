const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ message: 'No auth token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'developmentsecret');
        
        // We need to set both the userId and _id fields for better compatibility
        req.user = { 
            ...decoded,
            _id: decoded.userId // Ensure _id is set for compatibility with mongoose
        };
        
        // For critical operations, ensure we're using a valid user ID
        if (!req.user._id) {
            return res.status(401).json({ message: 'Invalid user identifier in token' });
        }
        
        next();
    } catch (err) {
        console.error('Auth middleware error:', err);
        res.status(401).json({ message: 'Invalid token' });
    }
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Admin only.' });
    }
};

const hasPermission = (permission) => {
    return (req, res, next) => {
        if (req.user && (req.user.role === 'admin' || req.user.permissions?.includes(permission))) {
            next();
        } else {
            res.status(403).json({ message: 'Permission denied' });
        }
    };
};

module.exports = { auth, isAdmin, hasPermission };