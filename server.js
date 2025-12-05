const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const { putItem, getUserByEmail, getItemsByType } = require('./utils/dynamodb');

// Import routes
const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        message: 'Exceptionz API is running'
    });
});

// Initialize admin user if not exists
const initializeAdmin = async () => {
    try {
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@exceptionz.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'Exceptionz@9361';

        const existingAdmin = await getUserByEmail(adminEmail);

        if (!existingAdmin) {
            console.log('Creating admin user...');
            const hashedPassword = await bcrypt.hash(adminPassword, 10);

            const adminUser = {
                id: `user_admin_${uuidv4()}`,
                type: 'user',
                email: adminEmail.toLowerCase(),
                password: hashedPassword,
                name: 'Admin',
                role: 'admin',
                isBlocked: false,
                createdAt: new Date().toISOString(),
            };

            await putItem(adminUser);
            console.log(`Admin user created: ${adminEmail}`);
        } else {
            console.log('Admin user already exists');
        }
    } catch (error) {
        console.error('Error initializing admin:', error);
    }
};

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, async () => {
    console.log(`\n🚀 Exceptionz Backend Server`);
    console.log(`================================`);
    console.log(`Server running on port ${PORT}`);
    console.log(`API Base: http://localhost:${PORT}/api`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log(`================================\n`);

    // Initialize admin
    await initializeAdmin();
});

module.exports = app;
