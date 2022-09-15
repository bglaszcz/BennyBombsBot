const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { token } = require('./config.json');

const client = new Client({ intents: [
							GatewayIntentBits.Guilds,
							GatewayIntentBits.GuildMessages,
							GatewayIntentBits.MessageContent,
							],
						});

client.commands = new Collection();

// Command Handling
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	client.commands.set(command.data.name, command);
}

// Event Handling
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const event = require(filePath);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	}
	else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

client.on('interactionCreate', async interaction => {

	if (!interaction.isChatInputCommand()) return;

	const command = client.commands.get(interaction.commandName);

	if (!command) return;

	try {
		await command.execute(interaction);
	}
	catch (error) {
		console.error(error);
		await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
	}
});

client.login(token);

// client.on('message', message => {

// 	if (message.content.toLowerCase().includes('deth toots') && message.author.id == '266356395094441986') {

// 		const tootDate = fs.readFileSync('./bootjaf/deth.txt', { 'encoding':'utf-8' });

// 		const diffTime = Math.abs(Date.now() - tootDate);
// 		const diffDays = Math.ceil(diffTime / (1000 * 3600));

// 		const myDate = new Date(Number(tootDate));

// 		message.channel.send(`Dal last had deth toots on ${myDate.toLocaleString()}. ${diffDays} hours since Dals last deth toots`);
// 		fs.writeFileSync(`./bootjaf/deth.txt`, `${Date.now()}`);
// 		return;
// 	}

// 	if (!message.content.startsWith(prefix) || message.author.bot) return;

// 	const args = message.content.slice(prefix.length).trim().split(/ +/);
// 	const command = args.shift().toLowerCase();

// 	if (!client.commands.has(command)) return;

// 	try {
// 		client.commands.get(command).execute(message, args);
// 	}
// 	catch (error) {
// 		console.error(error);
// 		message.reply('there was an error trying to execute that command!').then(m => {
// 			setTimeout(() => {
// 				m.delete();
// 			}, 5000);
// 		});
// 	}
// });