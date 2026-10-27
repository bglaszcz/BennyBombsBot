const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const { token } = require('./config.json');

const models = require('./models');
const userMemory = require('./services/userMemory');

const { sequelize } = models;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
    ],
    // Reactions on messages sent before the bot started arrive as partials
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.commands = new Collection();
// customId prefix -> handler, for buttons/select menus that outlive a collector
client.components = new Collection();
client.models = { ...models };
delete client.models.sequelize;
client.sequelize = sequelize;

// Command Handling
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

console.log('Loading commands...');

for (const filePath of getCommandFiles(commandsPath)) {
    try {
        const command = require(filePath);

        if (!command || !command.data || !command.data.name) {
            console.error(`Error in ${path.basename(filePath)}: Missing 'data' or 'data.name' property.`);
            continue;
        }

        // Folder name doubles as the /help category
        command.category = path.basename(path.dirname(filePath));
        client.commands.set(command.data.name, command);

        for (const [prefix, handler] of Object.entries(command.components || {})) {
            client.components.set(prefix, handler);
        }
    }
    catch (error) {
        console.error(`Failed to load command ${path.basename(filePath)}:`, error);
    }
}

// Event Handling
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

console.log('Loading events...');

for (const file of eventFiles) {
    try {
        const event = require(path.join(eventsPath, file));

        if (!event || !event.name || !event.execute) {
            console.error(`Error in ${file}: Missing 'name' or 'execute' property.`);
            continue;
        }

        const listener = (...args) => Promise.resolve(event.execute(...args))
            .catch(error => console.error(`Unhandled error in event ${file}:`, error));

        if (event.once) {
            client.once(event.name, listener);
        }
        else {
            client.on(event.name, listener);
        }
    }
    catch (error) {
        console.error(`Failed to load event ${file}:`, error);
    }
}

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

(async () => {
    try {
        // Creates missing tables only. Run `npm run db:sync` after changing a model's columns.
        await sequelize.sync();
        console.log('Database models synchronized successfully.');
    }
    catch (error) {
        console.error('Failed to sync database models:', error);
    }

    try {
        await client.login(token);
        console.log('Logged in successfully.');
    }
    catch (error) {
        console.error('Failed to log in:', error);
    }
})();

// Graceful shutdown
let shuttingDown = false;

async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}, shutting down...`);
    userMemory.flush();
    await client.destroy();
    await sequelize.close();
    process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
