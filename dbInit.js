const { InteractionCollector } = require('discord.js');
const Sequelize = require('sequelize');
const sequelize = require('./db.js');

const ImageUsage = require('./models/OpenAIAPIUsage.js')(sequelize, Sequelize.DataTypes);

const force = process.argv.includes('--force') || process.argv.includes('-f');

(async () => {
    try {
        // Sync the "User" model to the database
        await ImageUsage.sync({ force });

        // Example data for initialization
        const initialUserData = [
            {
                username: 'bennybombs',
                prompt: 'hello',
                type: 'image'
            },
            // Add more initial data entries as needed
        ];

        // Create initial user data using bulkCreate
        await ImageUsage.bulkCreate(initialUserData);

        console.log('Database synced and initialized');

        // Close the database connection
        sequelize.close();
    } catch (error) {
        console.error('Error syncing and initializing database:', error);
    }
})();
