const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName(`fridaythen`)
        .setDescription(`It's Friday Thennnnn`),
    execute(interaction) {
        const today = new Date().toLocaleString('en-us', { weekday: 'long' });

        const dayData = {
            "Monday": {
                response: `Dafuq? It's *${today}*, not Friday fam`,
                image: "./assets/images/FridayThen/Monday-FridayThen.png"
            },
            "Tuesday": {
                response: `Dafuq? It's *${today}*, not Friday fam`,
                image: "./assets/images/FridayThen/Tuesday-FridayThen.png"
            },
            "Wednesday": {
                response: `Dafuq? It's *${today}*, not Friday fam`,
                image: "./assets/images/FridayThen/Wednesday-FridayThen.png"
            },
            "Thursday": {
                response: `Dafuq? It's *${today}*, not Friday fam`,
                image: "./assets/images/FridayThen/Thursday-FridayThen.png"
            },
            "Friday": {
                response: "https://www.youtube.com/watch?v=1AnG04qnLqI%27",
                image: null
            },
            "Saturday": {
                response: "https://www.youtube.com/watch?v=lfGt8-xICOU",
                image: null
            },
            "Sunday": {
                response: "The Sunday scaries are upon us.",
                image: "https://health.clevelandclinic.org/sunday-scaries/"
            }
        };

        const dayInfo = dayData[today];

        if (dayInfo) {
            interaction.reply(dayInfo.response);
            if (dayInfo.image) {
                interaction.channel.send({ files: [dayInfo.image] });
            }
        }
    },
};
