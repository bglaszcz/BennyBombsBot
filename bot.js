const fs = require('fs');
//import Discord from 'discord.js';
const Discord = require('discord.js');
//import 'dotenv';
require('dotenv').config();

const  token = process.env.token;
const  prefix = process.env.prefix;

const client = new Discord.Client();
client.commands = new Discord.Collection();

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	client.commands.set(command.name, command);
}

client.once('ready', () => {
	console.log('Ready!');
});

client.on('message', message => {

	if (message.content.toLowerCase().includes("deth toots") && message.author.id == "266356395094441986") {

		var tootDate = fs.readFileSync(`./bootjaf/deth.txt`, {"encoding":"utf-8"});
		
		const diffTime = Math.abs(Date.now() - tootDate);
        const diffDays = Math.ceil(diffTime / (1000 * 3600));
		
		var myDate = new Date(Number(tootDate));
        
        message.channel.send(`Dal last had deth toots on ${myDate.toLocaleString()}. ${diffDays} hours since Dals last deth toots`);
    	var writing = fs.writeFileSync(`./bootjaf/deth.txt`, `${Date.now()}`);
		return;
	}

	if (!message.content.startsWith(prefix) || message.author.bot) return;

	const args = message.content.slice(prefix.length).trim().split(/ +/);
	const command = args.shift().toLowerCase();

	if (!client.commands.has(command)) return;

	try {
		client.commands.get(command).execute(message, args);
	} catch (error) {
		console.error(error);
		message.reply('there was an error trying to execute that command!').then(m => {
			setTimeout(() => {
				m.delete()
			}, 5000)
		});
	}
});

client.login(token);