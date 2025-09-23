const { REST, Routes } = require('discord.js');
const { clientId, token } = require('../config.json');
const fs = require('fs');
const path = require('path');

const commands = [];

// Define the path to the root commands directory
const commandsPath = path.join(__dirname, '../commands');
console.log(`Looking for commands in: ${commandsPath}`);

// Recursively get all .js files from the subdirectories
function getCommandFiles(dir) {
    console.log(`Scanning directory: ${dir}`);
    const dirents = fs.readdirSync(dir, { withFileTypes: true });
    const files = dirents.filter(dirent => dirent.isFile() && dirent.name.endsWith('.js')).map(dirent => path.join(dir, dirent.name));
    
    console.log(`Found ${files.length} JS files in ${dir}:`);
    files.forEach(file => console.log(`  - ${file}`));
    
    const dirs = dirents.filter(dirent => dirent.isDirectory()).map(dirent => path.join(dir, dirent.name));

    for (const subdir of dirs) {
        files.push(...getCommandFiles(subdir));
    }

    return files;
}

const commandFiles = getCommandFiles(commandsPath);
console.log(`\nTotal command files found: ${commandFiles.length}`);

// Load and process each command file
for (const filePath of commandFiles) {
    console.log(`\nProcessing command file: ${filePath}`);
    try {
        const command = require(filePath);
        console.log(`  Command loaded. Has data: ${!!command.data}, Has execute: ${!!command.execute}`);
        
        if ('data' in command && 'execute' in command) {
            const commandData = command.data.toJSON();
            console.log(`  Adding command: ${commandData.name}`);
            commands.push(commandData);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    } catch (error) {
        console.error(`  Error loading command from ${filePath}:`, error);
    }
}

console.log(`\nCommands to be deployed (${commands.length}):`, commands.map(cmd => cmd.name).join(', '));

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(token);

// and deploy your commands!
(async () => {
    try {
        console.log(`\nStarted refreshing ${commands.length} application (/) commands.`);

        const data = await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        console.log(`\nSuccessfully reloaded ${data.length} application (/) commands:`);
        console.log(data.map(cmd => cmd.name).join(', '));
    } catch (error) {
        console.error('\nError deploying commands:', error);
    }
})();