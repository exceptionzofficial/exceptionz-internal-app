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
        const {
            name, description, clientId, status, startDate, dueDate,
            modules, financials, documents, activities, location, imageUrl
        } = req.body;

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
            location: location || null,
            imageUrl: imageUrl || null,
            startDate: startDate || new Date().toISOString(),
            dueDate: dueDate || null,
            // Modules
            modules: (modules || []).map(m => ({
                id: `module_${uuidv4()}`,
                name: m.name,
                description: m.description || '',
                assignedTo: m.assignedTo || null,
                assignedToName: m.assignedToName || null,
                estimatedDays: m.estimatedDays || 0,
                status: 'pending',
                createdAt: new Date().toISOString(),
            })),
            // Financials
            financials: financials || {
                totalAmount: 0,
                paidAmount: 0,
                dueAmount: 0,
                dueDate: null,
            },
            // Documents
            documents: documents || [],
            // Activities
            activities: activities || [{
                id: `activity_${uuidv4()}`,
                type: 'project_created',
                title: 'Project Created',
                description: `Project "${name}" was created`,
                timestamp: new Date().toISOString(),
            }],
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

        const {
            name, description, clientId, status, startDate, dueDate,
            modules, financials, documents, activities, location, imageUrl
        } = req.body;

        const updates = {
            ...(name && { name }),
            ...(description !== undefined && { description }),
            ...(clientId !== undefined && { clientId }),
            ...(status && { status }),
            ...(startDate && { startDate }),
            ...(dueDate !== undefined && { dueDate }),
            ...(modules && { modules }),
            ...(financials !== undefined && { financials }),
            ...(documents !== undefined && { documents }),
            ...(activities !== undefined && { activities }),
            ...(location !== undefined && { location }),
            ...(imageUrl !== undefined && { imageUrl }),
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
        const { name, description, assignedTo, assignedToName, estimatedDays } = req.body;

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
            estimatedDays: estimatedDays || 0,
            status: 'pending',
            createdAt: new Date().toISOString(),
        };

        const updatedModules = [...(project.modules || []), newModule];

        // Add activity for module creation
        const newActivity = {
            id: `activity_${uuidv4()}`,
            type: 'module_added',
            title: 'Module Added',
            description: `Module "${name}" was added to the project`,
            timestamp: new Date().toISOString(),
        };
        const updatedActivities = [...(project.activities || []), newActivity];

        await updateItem(id, { modules: updatedModules, activities: updatedActivities });

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
        const { status, assignedTo, assignedToName, estimatedDays } = req.body;

        const project = await getItem(id);
        if (!project || project.type !== 'project') {
            return res.status(404).json({ error: 'Project not found' });
        }

        let moduleName = '';
        const updatedModules = (project.modules || []).map(m => {
            if (m.id === moduleId) {
                moduleName = m.name;
                return {
                    ...m,
                    ...(status && { status }),
                    ...(assignedTo !== undefined && { assignedTo }),
                    ...(assignedToName !== undefined && { assignedToName }),
                    ...(estimatedDays !== undefined && { estimatedDays }),
                    updatedAt: new Date().toISOString(),
                };
            }
            return m;
        });

        // Add activity for status change
        let updatedActivities = project.activities || [];
        if (status) {
            const newActivity = {
                id: `activity_${uuidv4()}`,
                type: 'module_status_changed',
                title: `Module ${status === 'completed' ? 'Completed' : 'Updated'}`,
                description: `Module "${moduleName}" status changed to ${status}`,
                timestamp: new Date().toISOString(),
            };
            updatedActivities = [...updatedActivities, newActivity];
        }

        await updateItem(id, { modules: updatedModules, activities: updatedActivities });
        res.json({ success: true, message: 'Module updated' });
    } catch (error) {
        console.error('Update module error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============ UPDATE FINANCIALS ============
router.put('/:id/financials', async (req, res) => {
    try {
        const { id } = req.params;
        const { totalAmount, paidAmount, dueDate } = req.body;

        const project = await getItem(id);
        if (!project || project.type !== 'project') {
            return res.status(404).json({ error: 'Project not found' });
        }

        const financials = {
            totalAmount: totalAmount !== undefined ? totalAmount : (project.financials?.totalAmount || 0),
            paidAmount: paidAmount !== undefined ? paidAmount : (project.financials?.paidAmount || 0),
            dueAmount: (totalAmount || project.financials?.totalAmount || 0) - (paidAmount || project.financials?.paidAmount || 0),
            dueDate: dueDate !== undefined ? dueDate : (project.financials?.dueDate || null),
        };

        // Add activity for payment
        const activities = project.activities || [];
        if (paidAmount !== undefined && paidAmount !== project.financials?.paidAmount) {
            activities.push({
                id: `activity_${uuidv4()}`,
                type: 'payment_received',
                title: 'Payment Received',
                description: `Payment of ₹${paidAmount.toLocaleString()} recorded`,
                timestamp: new Date().toISOString(),
            });
        }

        await updateItem(id, { financials, activities });
        res.json({ success: true, financials });
    } catch (error) {
        console.error('Update financials error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============ ADD DOCUMENT ============
router.post('/:id/documents', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, url, type } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Document name is required' });
        }

        const project = await getItem(id);
        if (!project || project.type !== 'project') {
            return res.status(404).json({ error: 'Project not found' });
        }

        const newDocument = {
            id: `doc_${uuidv4()}`,
            name,
            url: url || null,
            type: type || 'other',
            uploadedAt: new Date().toISOString(),
            uploadedBy: req.user.id,
            uploadedByName: req.user.name,
        };

        const updatedDocuments = [...(project.documents || []), newDocument];

        // Add activity
        const newActivity = {
            id: `activity_${uuidv4()}`,
            type: 'document_uploaded',
            title: 'Document Uploaded',
            description: `Document "${name}" was uploaded`,
            timestamp: new Date().toISOString(),
        };
        const updatedActivities = [...(project.activities || []), newActivity];

        await updateItem(id, { documents: updatedDocuments, activities: updatedActivities });

        res.status(201).json({ success: true, document: newDocument });
    } catch (error) {
        console.error('Add document error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============ DELETE DOCUMENT ============
router.delete('/:id/documents/:docId', async (req, res) => {
    try {
        const { id, docId } = req.params;

        const project = await getItem(id);
        if (!project || project.type !== 'project') {
            return res.status(404).json({ error: 'Project not found' });
        }

        const updatedDocuments = (project.documents || []).filter(d => d.id !== docId);
        await updateItem(id, { documents: updatedDocuments });

        res.json({ success: true, message: 'Document deleted' });
    } catch (error) {
        console.error('Delete document error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============ ADD ACTIVITY ============
router.post('/:id/activities', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, type } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Activity title is required' });
        }

        const project = await getItem(id);
        if (!project || project.type !== 'project') {
            return res.status(404).json({ error: 'Project not found' });
        }

        const newActivity = {
            id: `activity_${uuidv4()}`,
            type: type || 'general',
            title,
            description: description || '',
            timestamp: new Date().toISOString(),
            createdBy: req.user.id,
            createdByName: req.user.name,
        };

        const updatedActivities = [...(project.activities || []), newActivity];
        await updateItem(id, { activities: updatedActivities });

        res.status(201).json({ success: true, activity: newActivity });
    } catch (error) {
        console.error('Add activity error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
