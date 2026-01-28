const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { token } = require('./config.json');

// Add database imports
const { Sequelize } = require('sequelize');
const sequelize = require('./db.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.commands = new Collection();

// Initialize database models
console.log('Initializing database models...');
try {
    // Load your existing models
    const GMCMessage = require('./models/GMCMessage')(sequelize, Sequelize.DataTypes);
    const GACMessage = require('./models/GACMessage')(sequelize, Sequelize.DataTypes);
    const User = require('./models/User')(sequelize, Sequelize.DataTypes);
    const LevelUpMessage = require('./models/LevelUpMessage')(sequelize, Sequelize.DataTypes);
    const OutOfContext = require('./models/OutOfContext')(sequelize, Sequelize.DataTypes);
    const Nomination = require('./models/Nomination')(sequelize, Sequelize.DataTypes);
    const WordleScore = require('./models/WordleScore')(sequelize, Sequelize.DataTypes);

    // Make models accessible via client
    client.models = {
        GMCMessage,
        GACMessage,
        User,
        LevelUpMessage,
        OutOfContext,
        Nomination,
        WordleScore,
    };
    client.sequelize = sequelize;

    // Sync all models (alter: true adds new columns to existing tables)
    sequelize.sync({ alter: true })
        .then(() => console.log('Database models synchronized successfully.'))
        .catch(error => console.error('Failed to sync database models:', error));

} catch (error) {
    console.error('Error initializing database models:', error);
}

// Command Handling with Debugging
const commandsPath = path.join(__dirname, 'commands');

function getCommandFiles(dir) {
    const dirents = fs.readdirSync(dir, { withFileTypes: true });
    const files = dirents
        .filter(dirent => dirent.isFile() && dirent.name.endsWith('.js'))
        .map(dirent => path.join(dir, dirent.name));
    const dirs = dirents
        .filter(dirent => dirent.isDirectory())
        .map(dirent => path.join(dir, dirent.name));
    for (const subdir of dirs) {
        files.push(...getCommandFiles(subdir));
    }
    return files;
}

const commandFiles = getCommandFiles(commandsPath);

console.log('Loading commands...');

for (const filePath of commandFiles) {
    try {
        const command = require(filePath);

        if (!command || !command.data || !command.data.name) {
            console.error(`Error in ${path.basename(filePath)}: Missing 'data' or 'data.name' property.`);
            continue;
        }

        client.commands.set(command.data.name, command);
    } catch (error) {
        console.error(`Failed to load command ${path.basename(filePath)}:`, error);
    }
}

// Event Handling with Debugging
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

console.log('Loading events...');

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);

    try {
        const event = require(filePath);

        // Debugging: Log event structure
        // console.log(`Loading event from ${filePath}:`, event);

        // Check if event has the required properties
        if (!event || !event.name || !event.execute) {
            console.error(`Error in ${file}: Missing 'name' or 'execute' property.`);
            continue; // Skip this file if it's not structured correctly
        }

        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
            // console.log(`Event '${event.name}' loaded as once.`);
        } else {
            client.on(event.name, (...args) => event.execute(...args));
            // console.log(`Event '${event.name}' loaded.`);
        }
    } catch (error) {
        console.error(`Failed to load event ${file}:`, error);
    }
}

// Log in the client
client.login(token)
    .then(() => console.log('Logged in successfully.'))
    .catch(error => console.error('Failed to log in:', error));