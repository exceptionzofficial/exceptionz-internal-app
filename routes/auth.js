const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const { putItem, getItem, getItemsByType, deleteItem, updateItem, getUserByEmail } = require('../utils/dynamodb');
const { authenticateToken, requireAdmin, generateToken } = require('../middleware/auth');

// ============ PUBLIC ROUTES ============

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await getUserByEmail(email.toLowerCase());

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Check password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Check if blocked
        if (user.isBlocked) {
            return res.status(403).json({ error: 'Your account has been blocked. Contact admin.' });
        }

        // Generate token
        const token = generateToken(user);

        // Return user data (without password)
        const { password: _, ...userWithoutPassword } = user;
        res.json({
            success: true,
            token,
            user: userWithoutPassword,
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// ============ PROTECTED ROUTES ============

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await getItem(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const { password: _, ...userWithoutPassword } = user;
        res.json({ success: true, user: userWithoutPassword });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all users (for chat and assignments)
router.get('/users', authenticateToken, async (req, res) => {
    try {
        const users = await getItemsByType('user');
        // Remove passwords and filter blocked users for non-admins
        const safeUsers = users
            .filter(u => req.user.role === 'admin' || !u.isBlocked)
            .map(({ password, ...user }) => user);
        res.json({ success: true, users: safeUsers });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============ ADMIN ROUTES ============

// Create user (Admin only)
router.post('/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Check if email exists
        const existingUser = await getUserByEmail(email.toLowerCase());
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = {
            id: `user_${uuidv4()}`,
            type: 'user',
            email: email.toLowerCase(),
            password: hashedPassword,
            name,
            role: 'user',
            isBlocked: false,
            createdAt: new Date().toISOString(),
            createdBy: req.user.id,
        };

        await putItem(newUser);

        const { password: _, ...userWithoutPassword } = newUser;
        res.status(201).json({ success: true, user: userWithoutPassword });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Block user (Admin only)
router.put('/users/:id/block', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const user = await getItem(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.role === 'admin') {
            return res.status(400).json({ error: 'Cannot block admin' });
        }

        await updateItem(id, { isBlocked: true });
        res.json({ success: true, message: 'User blocked' });
    } catch (error) {
        console.error('Block user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Unblock user (Admin only)
router.put('/users/:id/unblock', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const user = await getItem(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        await updateItem(id, { isBlocked: false });
        res.json({ success: true, message: 'User unblocked' });
    } catch (error) {
        console.error('Unblock user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete user (Admin only)
router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const user = await getItem(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.role === 'admin') {
            return res.status(400).json({ error: 'Cannot delete admin' });
        }

        await deleteItem(id);
        res.json({ success: true, message: 'User deleted' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
