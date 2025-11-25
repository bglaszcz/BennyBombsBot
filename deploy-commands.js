const { REST, Routes } = require('discord.js');
const { clientId, token, guildId } = require('./config.json');
const fs = require('fs');
const path = require('path');

// Command line arguments
const args = process.argv.slice(2);
const deployGlobal = args.includes('--global') || args.includes('-g');
const deployGuild = args.includes('--guild') || args.includes('--test');
const deleteAll = args.includes('--delete');

const commands = [];

// Get all command files
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

// Load commands
console.log('📂 Loading commands...');
for (const filePath of commandFiles) {
    try {
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
            console.log(`   ✅ Loaded: ${command.data.name}`);
        } else {
            console.log(`   ⚠️  Skipped: ${path.basename(filePath)} (missing data or execute)`);
        }
    } catch (error) {
        console.log(`   ❌ Error loading ${path.basename(filePath)}:`, error.message);
    }
}

console.log(`\n📊 Total commands loaded: ${commands.length}\n`);

const rest = new REST().setToken(token);

(async () => {
    try {
        // Delete commands if requested
        if (deleteAll) {
            console.log('🗑️  Deleting all commands...');
            
            if (guildId) {
                await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
                console.log('   ✅ Deleted all guild commands');
            }
            
            await rest.put(Routes.applicationCommands(clientId), { body: [] });
            console.log('   ✅ Deleted all global commands\n');
        }

        // Deploy to guild (test server) - instant update
        if (deployGuild && guildId) {
            console.log('🚀 Deploying to guild (test server)...');
            const data = await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: commands },
            );
            console.log(`   ✅ Successfully deployed ${data.length} guild commands`);
            console.log('   ⚡ Commands are available immediately!\n');
        }

        // Deploy globally - takes up to 1 hour to propagate
        if (deployGlobal) {
            console.log('🌍 Deploying globally...');
            const data = await rest.put(
                Routes.applicationCommands(clientId),
                { body: commands },
            );
            console.log(`   ✅ Successfully deployed ${data.length} global commands`);
            console.log('   ⏳ Note: Global commands may take up to 1 hour to update\n');
        }

        // Default behavior if no flags specified
        if (!deployGlobal && !deployGuild && !deleteAll) {
            console.log('ℹ️  Usage:');
            console.log('   node deploy-commands.js --guild    (instant, test server only)');
            console.log('   node deploy-commands.js --global   (all servers, takes ~1 hour)');
            console.log('   node deploy-commands.js --delete   (remove all commands)');
            console.log('\n💡 For testing new commands, use --guild for instant updates!\n');
        }

    } catch (error) {
        console.error('❌ Deployment error:', error);
    }
})();