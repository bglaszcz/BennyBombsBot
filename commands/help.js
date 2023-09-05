const fs = require("fs");
const path = require("path");
const { EmbedBuilder } = require('discord.js');
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('help')
		.setDescription('Show help menu'),
	async execute(interaction) {
		const excludedFiles = ['help.js', 'b3.js', 'prune.js', 'test.js'];

		const commandsDirectory = path.join(__dirname);

		fs.readdir(commandsDirectory, (err, files) => {
			if (err) console.error(err);

			const jsfiles = files.filter(f => f.endsWith(".js") && !excludedFiles.includes(f));
			if (jsfiles.length <= 0) {
				console.log("No commands to load!");
				return;
			}

			const nameHelp = [];
			const descHelp = [];

			jsfiles.forEach(f => {
				const props = require(path.join(commandsDirectory, f));
				nameHelp.push(props.data.name);
				descHelp.push(props.data.description);
			});

			const exampleEmbed = new EmbedBuilder()
				.setColor('#0099ff');

			for (let i = 0; i < nameHelp.length; i++) {
				exampleEmbed.addFields({
					name: nameHelp[i],
					value: descHelp[i],
					inline: true,
				});
			}

			interaction.reply({ embeds: [exampleEmbed] });
		});
	},
};
