const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
require('dotenv').config();

const client = new DynamoDBClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const TABLE_NAME = process.env.DYNAMODB_TABLE;

const createTable = async () => {
    console.log(`\nChecking DynamoDB table: ${TABLE_NAME}`);
    console.log(`Region: ${process.env.AWS_REGION}`);
    console.log('='.repeat(50));

    try {
        // Check if table exists
        const describeCommand = new DescribeTableCommand({ TableName: TABLE_NAME });
        const tableInfo = await client.send(describeCommand);
        console.log(`✅ Table "${TABLE_NAME}" already exists`);
        console.log(`   Status: ${tableInfo.Table.TableStatus}`);
        console.log(`   Item Count: ${tableInfo.Table.ItemCount}`);
        return true;
    } catch (error) {
        if (error.name === 'ResourceNotFoundException') {
            console.log(`❌ Table "${TABLE_NAME}" not found. Creating...`);

            try {
                const createCommand = new CreateTableCommand({
                    TableName: TABLE_NAME,
                    KeySchema: [
                        { AttributeName: 'id', KeyType: 'HASH' }, // Partition key
                    ],
                    AttributeDefinitions: [
                        { AttributeName: 'id', AttributeType: 'S' },
                    ],
                    BillingMode: 'PAY_PER_REQUEST', // On-demand capacity
                });

                await client.send(createCommand);
                console.log(`✅ Table "${TABLE_NAME}" created successfully!`);
                console.log('   Waiting for table to become active...');

                // Wait for table to be active
                let isActive = false;
                let attempts = 0;
                while (!isActive && attempts < 30) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    const status = await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
                    if (status.Table.TableStatus === 'ACTIVE') {
                        isActive = true;
                        console.log('   ✅ Table is now ACTIVE');
                    } else {
                        console.log(`   ⏳ Table status: ${status.Table.TableStatus}`);
                    }
                    attempts++;
                }

                return true;
            } catch (createError) {
                console.error('❌ Error creating table:', createError.message);
                return false;
            }
        } else {
            console.error('❌ Error checking table:', error.message);
            return false;
        }
    }
};

// Run the script
createTable().then(success => {
    if (success) {
        console.log('\n✅ DynamoDB setup complete!');
        console.log('   You can now run: npm start');
    } else {
        console.log('\n❌ DynamoDB setup failed.');
        console.log('   Please check your AWS credentials and permissions.');
    }
    process.exit(success ? 0 : 1);
});
