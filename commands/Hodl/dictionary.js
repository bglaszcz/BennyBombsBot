const fetch = require('node-fetch');
const Discord = require("discord.js");
const axios = require('axios');
const util = require("/home/ben/Desktop/BennyBombsBot/util.js");
const {
	arrayToSentence,
} = require("/home/ben/Desktop/BennyBombsBot/util.js");
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName(`def`)
        .setDescription(`Definitions`)
        .addStringOption(option => option.setName('word')
            .setDescription('Word or phrase to define.')
            .setRequired(true)),
	async execute(interaction) {

        let words = interaction.options.getString('word');

		if (words > 1) {
			words = words.join('-');
		}
		else 
			return message.channel.send("https://www.merriam-webster.com/word-of-the-day");
		},

		axios.get(`https://dictionaryapi.com/api/v3/references/collegiate/json/${args}?key=a6b0ff1e-a72c-4860-bc1d-20e05f2e6cdc`)
			// .get(
			// 	`https://dictionaryapi.com/api/v3/references/collegiate/json/${args}?key=a6b0ff1e-a72c-4860-bc1d-20e05f2e6cdc`,
			// )
			.then(function(response) {
				const data = response.data[0];

				// If the result is a list of strings, it's not a valid word.
				if (typeof data !== "object") {
					const result = new Discord.MessageEmbed()
						.setTitle(
							`Invalid word: The word youve entered isnt in the dictionary.`
						)
						.setColor(0xff0000);
					if (!response.data || response.data.length === 0)
						result.setDescription("");
					else
					{
						result.setDescription(
							"Maybe try one of these suggestions: \n" +
							arrayToSentence(response.data),
						);
					return message.channel.send(result);
					}

				let definitions = data.shortdef,
					type = data.fl,
					description = "";
				for (let i = 0; i < definitions.length; i++) {
					description += `[${i + 1}] ${definitions[i]}`;
					description += i == definitions.length - 1 ? "" : "\n";
				}

				// let audio = data.hwi.prs[0].sound.audio;
				let subdirectory = "";

				message.channel.send(
					new Discord.MessageEmbed()
					.setTitle(`Definition: ${args} (${type})`)
					.setColor(0x1af200)
					.setDescription(description)
					.setFooter("Dictionary Bot v0.1")
				);

				// message.channel.send(
				//   `${args[0]} is pronounced as [${data.hwi.prs[0].mw}]:`,
				//   attachment
				// );
			})
			.catch(function(error) {
				console.log(error);
				return message.channel.send(
					`Sorry, I can't define that at the moment ${message.author}!`
				);
			}),
        }
