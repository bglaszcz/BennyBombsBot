const { REST, Routes } = require('discord.js');
const { clientId, token } = require('../config.json');

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: [] } // Empty array to delete all global commands
        );
        console.log('Successfully cleared all global commands');
    } catch (error) {
        console.error('Error clearing global commands:', error);
    }
})();