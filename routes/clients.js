const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const { putItem, getItem, getItemsByType, deleteItem, updateItem } = require('../utils/dynamodb');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// ============ GET ALL CLIENTS ============
router.get('/', async (req, res) => {
    try {
        const clients = await getItemsByType('client');
        res.json({ success: true, clients });
    } catch (error) {
        console.error('Get clients error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============ GET SINGLE CLIENT ============
router.get('/:id', async (req, res) => {
    try {
        const client = await getItem(req.params.id);
        if (!client || client.type !== 'client') {
            return res.status(404).json({ error: 'Client not found' });
        }
        res.json({ success: true, client });
    } catch (error) {
        console.error('Get client error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============ CREATE CLIENT ============
router.post('/', async (req, res) => {
    try {
        const { name, email, phone, company, status, source, notes } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Client name is required' });
        }

        const newClient = {
            id: `client_${uuidv4()}`,
            type: 'client',
            name,
            email: email || '',
            phone: phone || '',
            company: company || '',
            status: status || 'new_lead',
            source: source || 'direct',
            notes: notes ? [{
                id: `note_${uuidv4()}`,
                text: notes,
                createdBy: req.user.id,
                createdByName: req.user.name,
                createdAt: new Date().toISOString(),
            }] : [],
            createdAt: new Date().toISOString(),
            createdBy: req.user.id,
            createdByName: req.user.name,
        };

        await putItem(newClient);
        res.status(201).json({ success: true, client: newClient });
    } catch (error) {
        console.error('Create client error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============ UPDATE CLIENT ============
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const client = await getItem(id);

        if (!client || client.type !== 'client') {
            return res.status(404).json({ error: 'Client not found' });
        }

        const { name, email, phone, company, status, source } = req.body;
        const updates = {
            ...(name && { name }),
            ...(email !== undefined && { email }),
            ...(phone !== undefined && { phone }),
            ...(company !== undefined && { company }),
            ...(status && { status }),
            ...(source && { source }),
            updatedAt: new Date().toISOString(),
        };

        const updatedClient = await updateItem(id, updates);
        res.json({ success: true, client: updatedClient });
    } catch (error) {
        console.error('Update client error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============ DELETE CLIENT ============
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const client = await getItem(id);

        if (!client || client.type !== 'client') {
            return res.status(404).json({ error: 'Client not found' });
        }

        await deleteItem(id);
        res.json({ success: true, message: 'Client deleted' });
    } catch (error) {
        console.error('Delete client error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============ ADD NOTE TO CLIENT ============
router.post('/:id/notes', async (req, res) => {
    try {
        const { id } = req.params;
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Note text is required' });
        }

        const client = await getItem(id);
        if (!client || client.type !== 'client') {
            return res.status(404).json({ error: 'Client not found' });
        }

        const newNote = {
            id: `note_${uuidv4()}`,
            text,
            createdBy: req.user.id,
            createdByName: req.user.name,
            createdAt: new Date().toISOString(),
        };

        const updatedNotes = [...(client.notes || []), newNote];
        await updateItem(id, { notes: updatedNotes });

        res.status(201).json({ success: true, note: newNote });
    } catch (error) {
        console.error('Add note error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
