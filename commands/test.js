// const fetch = require('node-fetch');
const fs = require('fs');
const emojis = require('../bootjaf/emojis.js');
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName(`test`)
        .setDescription(`Wish the crew good morning!`),
    async execute(interaction) {

        // interaction.guild.emojis

    },
};