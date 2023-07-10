const fs = require("fs");
const Discord = require("discord.js");
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`help`)
		.setDescription(`Show help menu`),
	async execute(message) {
		fs.readdir("./commands/", (err, files) => {
			if (err) console.error(err);

			const jsfiles = files.filter(f => f.split(".").pop() === "js");
			if (jsfiles.length <= 0) {
				console.log("No commands to load!");
				return;
			}

			let namelist = "";
			let desclist = "";

			const nameHelp = new Array();
			const descHelp = new Array();

			// let result =
			jsfiles.forEach((f, i) => {
				const props = require(`./${f}`);
				namelist = props.name;
				desclist = props.description;

				nameHelp[i] = namelist;
				descHelp[i] = desclist;
			});

			const exampleEmbed = new Discord.MessageEmbed()
				.setColor('#0099ff');
			for (let i = 0; i < nameHelp.length; i++) {
				exampleEmbed.addFields({
					name: nameHelp[i],
					value: descHelp[i],
					inline: true,
				});
			}
			message.channel.send(exampleEmbed);

		});
	},
};

// module.exports.help = {
// 	name: "help",
// 	description: "show all commands",
// };