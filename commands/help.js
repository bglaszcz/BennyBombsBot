const fs = require("fs");
const Discord = require("discord.js");

module.exports = {
	name: 'help',
	description: 'Help command',
	async execute(message, args) {
		fs.readdir("./commands/", (err, files) => {
			if (err) console.error(err);

			let jsfiles = files.filter(f => f.split(".").pop() === "js");
			if (jsfiles.length <= 0) {
				console.log("No commands to load!");
				return;
			}

			var namelist = "";
			var desclist = "";

			var nameHelp = new Array();
			var descHelp = new Array();

			let result = jsfiles.forEach((f, i) => {
				let props = require(`./${f}`);
				namelist = props.name;
				desclist = props.description;

				nameHelp[i] = namelist;
				descHelp[i] = desclist;
			});

			let exampleEmbed = new Discord.MessageEmbed()
				.setColor('#0099ff')
			for (let i = 0; i < nameHelp.length; i++) {
				exampleEmbed.addFields({
					name: nameHelp[i],
					value: descHelp[i],
					inline: true
				});
			}
			message.channel.send(exampleEmbed);

		});
	},
}

module.exports.help = {
	name: "help",
	description: "show all commands",
}