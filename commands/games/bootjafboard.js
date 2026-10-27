const { SlashCommandBuilder, codeBlock } = require('discord.js');
const { BootJaf, sequelize } = require('../../models');
const { getNickname, getNicknameByUsername } = require('../../utils/getNickname');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('bootjafboard')
		.setDescription('Show who has booted jaf the most'),
    async execute(interaction) {
        const bootJafDisplay = await BootJaf.findAll({
            // Grouped by userId; the one pre-userId row falls back to its username
            attributes: [
                [sequelize.fn('MAX', sequelize.col('userId')), 'userId'],
                [sequelize.fn('MAX', sequelize.col('username')), 'username'],
                [sequelize.fn('COUNT', sequelize.col('*')), 'boots'],
            ],
            group: [sequelize.fn('COALESCE', sequelize.col('userId'), sequelize.col('username'))],
            order: [[sequelize.fn('COUNT', sequelize.col('*')), 'DESC']],
            raw: true,
        });

        if (bootJafDisplay.length === 0) {
            return interaction.reply('Jaf remains unbooted. For now. 🥾');
        }

        const board = codeBlock(bootJafDisplay
            .map((row, position) => `(${position + 1}) ${row.userId ? getNickname(row.userId, row.username) : getNicknameByUsername(row.username)}: ${row.boots}`)
            .join('\n'));

        await interaction.reply(board);
    },
};
