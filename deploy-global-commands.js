const { REST, Routes } = require('discord.js');
const { clientId, token } = require('./config.json');
const fs = require('fs');
const path = require('path');


const commands = [];

// Define the path to the root commands directory
const commandsPath = path.join(__dirname, 'commands');

// Recursively get all .js files from the subdirectories
function getCommandFiles(dir) {
    const dirents = fs.readdirSync(dir, { withFileTypes: true });
    const files = dirents.filter(dirent => dirent.isFile() && dirent.name.endsWith('.js')).map(dirent => path.join(dir, dirent.name));
    const dirs = dirents.filter(dirent => dirent.isDirectory()).map(dirent => path.join(dir, dirent.name));

    for (const subdir of dirs) {
        files.push(...getCommandFiles(subdir));
    }

    return files;
}

const commandFiles = getCommandFiles(commandsPath);

// Load and process each command file
for (const filePath of commandFiles) {
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(token);

// and deploy your commands!
(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        const data = await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
})();
