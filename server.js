const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001', 'https://www.bakerycrm.shop'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    credentials: true,
    maxAge: 600, // Cache preflight requests for 10 minutes
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

// Body parsing middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Debug middleware to log all requests
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`${req.method} ${req.url}`);
        console.log('Headers:', req.headers);
        if (req.method !== 'GET') {
            console.log('Body:', req.body);
        }
        next();
    });
}

// MongoDB Connection with debug logging
console.log('Attempting MongoDB connection...');
console.log('MongoDB URI:', process.env.MONGODB_URI || 'mongodb://localhost:27017/taskman');

mongoose.set('debug', true); // Enable mongoose debug mode
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/taskman', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => {
    console.log('Connected to MongoDB');
    console.log('MongoDB connection state:', mongoose.connection.readyState);
    console.log('Current database:', mongoose.connection.db?.databaseName);
})
.catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});

// Monitor MongoDB connection
mongoose.connection.on('error', err => {
    console.error('MongoDB error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/users', require('./routes/users'));
app.use('/api/tasks', require('./routes/tasks'));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error details:', err);
    
    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const errors = {};
        Object.keys(err.errors).forEach(key => {
            errors[key] = err.errors[key].message;
        });
        return res.status(400).json({ 
            message: 'Validation Error',
            errors 
        });
    }
    
    // JWT authentication error
    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({ message: 'Invalid token' });
    }
    
    // Default error
    res.status(500).json({ 
        message: 'Server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`API URL: http://localhost:${PORT}/api`);
});