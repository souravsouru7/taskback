# Task Management System for Interior Design Company

A web application for managing tasks and projects in an interior design company, with support for admin and employee roles.

## Features

- User Authentication (Admin & Employee)
- Task Management
  - Create, read, update, delete tasks
  - Assign tasks to employees
  - Set deadlines and priorities
  - Track task status
- Project Management
  - Create and manage projects
  - Link tasks to projects
  - Track project milestones
- Dashboard
  - View assigned tasks
  - Track progress
  - View project status

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd taskman
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory and add the following variables:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/taskman
JWT_SECRET=your-secret-key-here
```

4. Start MongoDB:
```bash
mongod
```

5. Start the server:
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## API Endpoints

### Authentication
- POST `/api/auth/register` - Register new user (Admin only)
- POST `/api/auth/login` - Login user
- GET `/api/auth/me` - Get current user

### Users
- GET `/api/users` - Get all users (Admin only)
- GET `/api/users/:id` - Get user by ID
- PUT `/api/users/:id` - Update user
- PUT `/api/users/:id/role` - Update user role (Admin only)
- DELETE `/api/users/:id` - Delete user (Admin only)
- GET `/api/users/:id/tasks` - Get user's tasks
- GET `/api/users/:id/projects` - Get user's projects

### Tasks
- GET `/api/tasks` - Get all tasks
- POST `/api/tasks` - Create new task
- GET `/api/tasks/:id` - Get task by ID
- PUT `/api/tasks/:id` - Update task
- DELETE `/api/tasks/:id` - Delete task (Admin only)
- POST `/api/tasks/:id/comments` - Add comment to task

### Projects
- GET `/api/projects` - Get all projects
- POST `/api/projects` - Create new project
- GET `/api/projects/:id` - Get project by ID
- PUT `/api/projects/:id` - Update project
- DELETE `/api/projects/:id` - Delete project (Admin only)
- POST `/api/projects/:id/team` - Add team member to project
- DELETE `/api/projects/:id/team/:userId` - Remove team member from project
- POST `/api/projects/:id/milestones` - Add milestone to project
- PUT `/api/projects/:id/milestones/:milestoneId` - Update milestone status

## Security

- JWT-based authentication
- Role-based access control
- Password hashing with bcrypt
- Input validation with express-validator

## Frontend

The frontend part of the application will be developed separately using React.js. Stay tuned for updates! 