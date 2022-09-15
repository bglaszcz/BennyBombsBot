// const fs = require('fs');
// const imageFiles = fs.readdirSync('./images/FridayThen');
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName(`fridaythen`)
        .setDescription(`It's Friday Thennnnn`),
    execute(interaction) {
        const today = new Date().toLocaleString('en-us', { weekday: 'long' });

        const images = new Array();

        images[0] = `./images/FridayThen/Monday-FridayThen.png`;
        images[1] = `./images/FridayThen/Tuesday-FridayThen.png`;
        images[2] = `./images/FridayThen/Wednesday-FridayThen.png`;
        images[3] = `./images/FridayThen/Thursday-FridayThen.png`;

        if (today == "Monday") {
            interaction.reply(`Dafuq? It's *${today}*, not Friday fam`);
            interaction.channel.send({ files: [images[0]] });
        }
        else if (today == "Tuesday") {
            interaction.reply(`Dafuq? It's *${today}*, not Friday fam`);
            interaction.channel.send({ files: [images[1]] });
        }
        else if (today == "Wednesday") {
            interaction.reply(`Dafuq? It's *${today}*, not Friday fam`);
            interaction.channel.send({ files: [images[2]] });
        }
        else if (today == "Thursday") {
            interaction.reply(`Dafuq? It's *${today}*, not Friday fam`);
            interaction.channel.send({ files: [images[3]] });
        }
        else if (today == "Friday") {
            interaction.reply(`https://www.youtube.com/watch?v=1AnG04qnLqI%27`);
        }
        else if (today == "Saturday") {
            const randoVid = Math.floor(Math.random() * 3);
            if (randoVid == 0) {
                interaction.reply(`https://www.youtube.com/watch?v=COhGLcZW-X4`);
            }
            else if (randoVid == 1) {
                interaction.reply(`https://www.youtube.com/watch?v=PeKTzfmLPiI`);
            }
            else if (randoVid == 2) {
                interaction.reply(`https://www.youtube.com/watch?v=BVc8Ja0iqRE`);
            }
        }
        else if (today == "Sunday") {
            interaction.reply(`The Sunday scaries are upon us.`);
            interaction.channel.send(`https://www.youtube.com/watch?v=oDJcGMfyg6E&t=19s`);
        }


    },
};