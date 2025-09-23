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
    
    // Sync all models (this creates the tables if they don't exist)
    sequelize.sync()
        .then(() => console.log('Database models synchronized successfully.'))
        .catch(error => console.error('Failed to sync database models:', error));
        
} catch (error) {
    console.error('Error initializing database models:', error);
}

// Command Handling with Debugging
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

console.log('Loading commands...');

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    
    try {
        const command = require(filePath);

        // Debugging: Log command structure
        // console.log(`Loading command from ${filePath}:`, command);

        // Check if command has the required properties
        if (!command || !command.data || !command.data.name) {
            console.error(`Error in ${file}: Missing 'data' or 'data.name' property.`);
            continue; // Skip this file if it's not structured correctly
        }

        // Add the command to the client's command collection
        client.commands.set(command.data.name, command);
        // console.log(`Command '${command.data.name}' loaded successfully.`);
    } catch (error) {
        console.error(`Failed to load command ${file}:`, error);
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