const { REST, Routes } = require('discord.js');
const { clientId, guildId, token } = require('../config.json');

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log('Listing global commands:');
        const globalCommands = await rest.get(
            Routes.applicationCommands(clientId)
        );
        console.log(globalCommands);

        console.log('\nListing guild-specific commands:');
        const guildCommands = await rest.get(
            Routes.applicationGuildCommands(clientId, guildId)
        );
        console.log(guildCommands);
    } catch (error) {
        console.error(error);
    }
})();
