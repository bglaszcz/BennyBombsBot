const fetch = require('node-fetch');
const { SlashCommandBuilder } = require('discord.js');
const Sequelize = require('sequelize');
const sequelize = require('../db.js');
const { tenorApiKey } = require('../config.json');

const BootJaf = require('../models/BootJaf')(sequelize, Sequelize.DataTypes);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('bootjaf')
		.setDescription('Count the times we boot jaf'),
    async execute(interaction) {

        const bootJafCount = await BootJaf.findOne({
            order: [ [ 'createdAt', 'DESC' ] ],
        });

        const bootJafCountDisplay = bootJafCount.usage_count + 1;

        interaction.reply(`${bootJafCountDisplay}`);

        try {
            await BootJaf.create({
                username: interaction.user.username,
                usage_count: bootJafCountDisplay,
            });
        }
        catch (error) {
            console.log(error);
        }

        const url = `https://g.tenor.com/v1/search?q=milk&key=${tenorApiKey}&limit=50`;
        const response = await fetch(url);
        const json = await response.json();

        const index = Math.floor(Math.random() * json.results.length);

        interaction.channel.send(json.results[index].url);
    },
};