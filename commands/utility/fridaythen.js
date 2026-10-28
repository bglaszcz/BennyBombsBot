const path = require('node:path');
const { SlashCommandBuilder } = require('discord.js');

const IMAGE_DIR = path.join(__dirname, '..', '..', 'assets', 'images', 'FridayThen');
const notFriday = today => `Dafuq? It's *${today}*, not Friday fam`;

const DAY_DATA = {
    Monday: { response: notFriday, image: 'Monday-FridayThen.png' },
    Tuesday: { response: notFriday, image: 'Tuesday-FridayThen.png' },
    Wednesday: { response: notFriday, image: 'Wednesday-FridayThen.png' },
    Thursday: { response: notFriday, image: 'Thursday-FridayThen.png' },
    Friday: { response: () => 'https://www.youtube.com/watch?v=1AnG04qnLqI' },
    Saturday: { response: () => 'https://www.youtube.com/watch?v=lfGt8-xICOU' },
    Sunday: { response: () => 'The Sunday scaries are upon us. 😱' },
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fridaythen')
        .setDescription('It\'s Friday Thennnnn'),
    async execute(interaction) {
        const today = new Date().toLocaleString('en-us', { weekday: 'long' });
        const { response, image } = DAY_DATA[today];

        await interaction.reply({
            content: response(today),
            files: image ? [path.join(IMAGE_DIR, image)] : [],
        });
    },
};
