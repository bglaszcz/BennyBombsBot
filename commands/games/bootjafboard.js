const { SlashCommandBuilder, codeBlock } = require('discord.js');
const Sequelize = require('sequelize');
const sequelize = require('../db.js');

const BootJaf = require('../models/BootJaf')(sequelize, Sequelize.DataTypes);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('bootjafboard')
		.setDescription(`Show who has booted jaf the most`),
    async execute(interaction) {

        const bootJafDisplay = await BootJaf.findAll({
            attributes: [
            `username`,
            [sequelize.fn('COUNT', sequelize.col('*')), `boots`],
            // order: [ [sequelize.fn('COUNT', sequelize.col('*')), 'DESC '] ],
            ],
            group: [`username`],
            order: [ [sequelize.fn('COUNT', sequelize.col('*')), 'DESC'] ],
        });

        const board = codeBlock(bootJafDisplay.map((i, position) => `(${position + 1}) ${i.dataValues.username}: ${i.dataValues.boots}`).join('\n'));

        interaction.reply(board);

    },
};