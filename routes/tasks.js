const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const { putItem, getItem, getItemsByType, deleteItem, updateItem } = require('../utils/dynamodb');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// ============ GET ALL TASKS ============
router.get('/', async (req, res) => {
    try {
        const tasks = await getItemsByType('task');
        res.json({ success: true, tasks });
    } catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============ GET MY TASKS ============
router.get('/my', async (req, res) => {
    try {
        const tasks = await getItemsByType('task');
        const myTasks = tasks.filter(t => t.assignedTo === req.user.id);
        res.json({ success: true, tasks: myTasks });
    } catch (error) {
        console.error('Get my tasks error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============ GET SINGLE TASK ============
router.get('/:id', async (req, res) => {
    try {
        const task = await getItem(req.params.id);
        if (!task || task.type !== 'task') {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json({ success: true, task });
    } catch (error) {
        console.error('Get task error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============ CREATE TASK ============
router.post('/', async (req, res) => {
    try {
        const { title, description, assignedTo, assignedToName, projectId, status, priority, dueDate } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Task title is required' });
        }

        const newTask = {
            id: `task_${uuidv4()}`,
            type: 'task',
            title,
            description: description || '',
            assignedTo: assignedTo || null,
            assignedToName: assignedToName || null,
            projectId: projectId || null,
            status: status || 'todo',
            priority: priority || 'medium',
            dueDate: dueDate || null,
            comments: [],
            createdAt: new Date().toISOString(),
            createdBy: req.user.id,
            createdByName: req.user.name,
        };

        await putItem(newTask);
        res.status(201).json({ success: true, task: newTask });
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============ UPDATE TASK ============
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const task = await getItem(id);

        if (!task || task.type !== 'task') {
            return res.status(404).json({ error: 'Task not found' });
        }

        const { title, description, assignedTo, assignedToName, projectId, status, priority, dueDate } = req.body;
        const updates = {
            ...(title && { title }),
            ...(description !== undefined && { description }),
            ...(assignedTo !== undefined && { assignedTo }),
            ...(assignedToName !== undefined && { assignedToName }),
            ...(projectId !== undefined && { projectId }),
            ...(status && { status }),
            ...(priority && { priority }),
            ...(dueDate !== undefined && { dueDate }),
            updatedAt: new Date().toISOString(),
        };

        const updatedTask = await updateItem(id, updates);
        res.json({ success: true, task: updatedTask });
    } catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============ DELETE TASK ============
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const task = await getItem(id);

        if (!task || task.type !== 'task') {
            return res.status(404).json({ error: 'Task not found' });
        }

        await deleteItem(id);
        res.json({ success: true, message: 'Task deleted' });
    } catch (error) {
        console.error('Delete task error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============ ADD COMMENT TO TASK ============
router.post('/:id/comments', async (req, res) => {
    try {
        const { id } = req.params;
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Comment text is required' });
        }

        const task = await getItem(id);
        if (!task || task.type !== 'task') {
            return res.status(404).json({ error: 'Task not found' });
        }

        const newComment = {
            id: `comment_${uuidv4()}`,
            text,
            createdBy: req.user.id,
            createdByName: req.user.name,
            createdAt: new Date().toISOString(),
        };

        const updatedComments = [...(task.comments || []), newComment];
        await updateItem(id, { comments: updatedComments });

        res.status(201).json({ success: true, comment: newComment });
    } catch (error) {
        console.error('Add comment error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============ GET TASKS BY PROJECT ============
router.get('/project/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const tasks = await getItemsByType('task');
        const projectTasks = tasks.filter(t => t.projectId === projectId);
        res.json({ success: true, tasks: projectTasks });
    } catch (error) {
        console.error('Get project tasks error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
