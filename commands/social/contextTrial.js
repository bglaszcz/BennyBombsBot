const { ContextMenuCommandBuilder, ApplicationCommandType } = require('discord.js');
const { startTrial, handleTrialVote } = require('../../services/trial');

module.exports = {
	cooldown: 60,
	data: new ContextMenuCommandBuilder()
		.setName('Put on Trial')
		.setType(ApplicationCommandType.Message),

	components: {
		'trial-vote': handleTrialVote,
	},

	execute: startTrial,
};
