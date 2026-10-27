const { SlashCommandBuilder, codeBlock } = require('discord.js');
const { BootJaf, sequelize } = require('../../models');
const { getNicknameByUsername } = require('../../utils/getNickname');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('bootjafboard')
		.setDescription('Show who has booted jaf the most'),
    async execute(interaction) {
        const bootJafDisplay = await BootJaf.findAll({
            attributes: [
                'username',
                [sequelize.fn('COUNT', sequelize.col('*')), 'boots'],
            ],
            group: ['username'],
            order: [[sequelize.fn('COUNT', sequelize.col('*')), 'DESC']],
            raw: true,
        });

        if (bootJafDisplay.length === 0) {
            return interaction.reply('Jaf remains unbooted. For now. 🥾');
        }

        const board = codeBlock(bootJafDisplay
            .map((row, position) => `(${position + 1}) ${getNicknameByUsername(row.username)}: ${row.boots}`)
            .join('\n'));

        await interaction.reply(board);
    },
};
