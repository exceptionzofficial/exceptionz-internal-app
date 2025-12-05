const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, ScanCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
require('dotenv').config();

// Create DynamoDB client
const client = new DynamoDBClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// Create document client for easier operations
const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
        removeUndefinedValues: true,
    },
});

const TABLE_NAME = process.env.DYNAMODB_TABLE;

// ============ GENERIC OPERATIONS ============

// Put item (create or update)
const putItem = async (item) => {
    const command = new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
    });
    return await docClient.send(command);
};

// Get item by ID
const getItem = async (id) => {
    const command = new GetCommand({
        TableName: TABLE_NAME,
        Key: { id },
    });
    const response = await docClient.send(command);
    return response.Item;
};

// Scan items by type (e.g., 'user', 'client', 'project', 'task')
const getItemsByType = async (type) => {
    const command = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: '#type = :type',
        ExpressionAttributeNames: {
            '#type': 'type',
        },
        ExpressionAttributeValues: {
            ':type': type,
        },
    });
    const response = await docClient.send(command);
    return response.Items || [];
};

// Delete item by ID
const deleteItem = async (id) => {
    const command = new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { id },
    });
    return await docClient.send(command);
};

// Update item
const updateItem = async (id, updates) => {
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    Object.keys(updates).forEach((key, index) => {
        if (key !== 'id') {
            const attrName = `#attr${index}`;
            const attrValue = `:val${index}`;
            updateExpressions.push(`${attrName} = ${attrValue}`);
            expressionAttributeNames[attrName] = key;
            expressionAttributeValues[attrValue] = updates[key];
        }
    });

    if (updateExpressions.length === 0) {
        return null;
    }

    const command = new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { id },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
    });

    const response = await docClient.send(command);
    return response.Attributes;
};

// Find user by email
const getUserByEmail = async (email) => {
    const command = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: '#type = :type AND #email = :email',
        ExpressionAttributeNames: {
            '#type': 'type',
            '#email': 'email',
        },
        ExpressionAttributeValues: {
            ':type': 'user',
            ':email': email.toLowerCase(),
        },
    });
    const response = await docClient.send(command);
    return response.Items && response.Items.length > 0 ? response.Items[0] : null;
};

module.exports = {
    putItem,
    getItem,
    getItemsByType,
    deleteItem,
    updateItem,
    getUserByEmail,
    TABLE_NAME,
};
