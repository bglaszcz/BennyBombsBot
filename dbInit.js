const { InteractionCollector } = require('discord.js');
const Sequelize = require('sequelize');
const sequelize = require('./db.js');

const User = require('./models/User.js')(sequelize, Sequelize.DataTypes);

const force = process.argv.includes('--force') || process.argv.includes('-f');

(async () => {
    try {
        // Sync the "User" model to the database
        await User.sync({ force });

        // Example data for initialization
        const initialUserData = [
            {
                userId: '204351379861536770',
                username: 'bennybombs',
                xp: 0,
                level: 1,
                lastMessageTime: 0,
            },
            // Add more initial data entries as needed
        ];

        // Create initial user data using bulkCreate
        await User.bulkCreate(initialUserData);

        console.log('Database synced and initialized');

        // Close the database connection
        sequelize.close();
    } catch (error) {
        console.error('Error syncing and initializing database:', error);
    }
})();
