// const fetch = require('node-fetch');
const fs = require('fs');
const emojis = require('../bootjaf/emojis.js');
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName(`gmc`)
        .setDescription(`Wish the crew good morning!`),
    async execute(interaction) {

        const gmc = fs.readFileSync(`./bootjaf/gmc.txt`, { "encoding":"utf-8" });
        const today = new Date().toLocaleString('en-us', { weekday: 'long' });

        const rando = Math.floor(Math.random() * 4) + 3;

        if (gmc == today) {
            interaction.reply("The crew has been wished good morning already.");
        }
        else {
        fs.writeFileSync(`./bootjaf/gmc.txt`, `${today}`);
        const emoji = new Array();
        let i = 0;
        while (i <= rando) {
            const randomEmoji = Math.floor(Math.random() * emojis.length) + 1;
            emoji[i] = emojis[randomEmoji];
            i++;
        }

        interaction.reply(emoji.join("") + `:regional_indicator_g:` + `:regional_indicator_m:` + `:regional_indicator_c:` +
            emoji.reverse().join(""));
    }
    },
};