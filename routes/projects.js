const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const { putItem, getItem, getItemsByType, deleteItem, updateItem } = require('../utils/dynamodb');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// ============ GET ALL PROJECTS ============
router.get('/', async (req, res) => {
    try {
        const projects = await getItemsByType('project');
        res.json({ success: true, projects });
    } catch (error) {
        console.error('Get projects error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============ GET SINGLE PROJECT ============
router.get('/:id', async (req, res) => {
    try {
        const project = await getItem(req.params.id);
        if (!project || project.type !== 'project') {
            return res.status(404).json({ error: 'Project not found' });
        }
        res.json({ success: true, project });
    } catch (error) {
        console.error('Get project error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============ CREATE PROJECT ============
router.post('/', async (req, res) => {
    try {
        const { name, description, clientId, status, startDate, dueDate, modules } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Project name is required' });
        }

        const newProject = {
            id: `project_${uuidv4()}`,
            type: 'project',
            name,
            description: description || '',
            clientId: clientId || null,
            status: status || 'planning',
            startDate: startDate || new Date().toISOString(),
            dueDate: dueDate || null,
            modules: (modules || []).map(m => ({
                id: `module_${uuidv4()}`,
                name: m.name,
                description: m.description || '',
                assignedTo: m.assignedTo || null,
                assignedToName: m.assignedToName || null,
                status: 'pending',
                createdAt: new Date().toISOString(),
            })),
            createdAt: new Date().toISOString(),
            createdBy: req.user.id,
            createdByName: req.user.name,
        };

        await putItem(newProject);
        res.status(201).json({ success: true, project: newProject });
    } catch (error) {
        console.error('Create project error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============ UPDATE PROJECT ============
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const project = await getItem(id);

        if (!project || project.type !== 'project') {
            return res.status(404).json({ error: 'Project not found' });
        }

        const { name, description, clientId, status, startDate, dueDate, modules } = req.body;
        const updates = {
            ...(name && { name }),
            ...(description !== undefined && { description }),
            ...(clientId !== undefined && { clientId }),
            ...(status && { status }),
            ...(startDate && { startDate }),
            ...(dueDate !== undefined && { dueDate }),
            ...(modules && { modules }),
            updatedAt: new Date().toISOString(),
        };

        const updatedProject = await updateItem(id, updates);
        res.json({ success: true, project: updatedProject });
    } catch (error) {
        console.error('Update project error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============ DELETE PROJECT ============
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const project = await getItem(id);

        if (!project || project.type !== 'project') {
            return res.status(404).json({ error: 'Project not found' });
        }

        await deleteItem(id);
        res.json({ success: true, message: 'Project deleted' });
    } catch (error) {
        console.error('Delete project error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============ ADD MODULE TO PROJECT ============
router.post('/:id/modules', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, assignedTo, assignedToName } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Module name is required' });
        }

        const project = await getItem(id);
        if (!project || project.type !== 'project') {
            return res.status(404).json({ error: 'Project not found' });
        }

        const newModule = {
            id: `module_${uuidv4()}`,
            name,
            description: description || '',
            assignedTo: assignedTo || null,
            assignedToName: assignedToName || null,
            status: 'pending',
            createdAt: new Date().toISOString(),
        };

        const updatedModules = [...(project.modules || []), newModule];
        await updateItem(id, { modules: updatedModules });

        res.status(201).json({ success: true, module: newModule });
    } catch (error) {
        console.error('Add module error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============ UPDATE MODULE STATUS ============
router.put('/:id/modules/:moduleId', async (req, res) => {
    try {
        const { id, moduleId } = req.params;
        const { status, assignedTo, assignedToName } = req.body;

        const project = await getItem(id);
        if (!project || project.type !== 'project') {
            return res.status(404).json({ error: 'Project not found' });
        }

        const updatedModules = (project.modules || []).map(m => {
            if (m.id === moduleId) {
                return {
                    ...m,
                    ...(status && { status }),
                    ...(assignedTo !== undefined && { assignedTo }),
                    ...(assignedToName !== undefined && { assignedToName }),
                    updatedAt: new Date().toISOString(),
                };
            }
            return m;
        });

        await updateItem(id, { modules: updatedModules });
        res.json({ success: true, message: 'Module updated' });
    } catch (error) {
        console.error('Update module error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
