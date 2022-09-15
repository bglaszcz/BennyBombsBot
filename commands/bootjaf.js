const fetch = require('node-fetch');
const fs = require('fs');
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('bootjaf')
		.setDescription('Count the times we boot jaf'),
    async execute(interaction) {

        let num = fs.readFileSync(`./bootjaf/bootjaf.txt`, { "encoding":"utf-8" });
            num++;
        fs.writeFileSync(`./bootjaf/bootjaf.txt`, `${num}`);
        interaction.reply(num.toString());

        const url = `https://g.tenor.com/v1/search?q=milk&key=VB2LPT9PUU0Z&limit=50`;
        const response = await fetch(url);
        const json = await response.json();

        const index = Math.floor(Math.random() * json.results.length);

        interaction.channel.send(json.results[index].url);
    },
};