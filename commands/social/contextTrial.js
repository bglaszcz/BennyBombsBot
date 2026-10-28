const { ContextMenuCommandBuilder, ApplicationCommandType } = require('discord.js');
const { startTrial, handleTrialFiling, handleTrialVote } = require('../../services/trial');

module.exports = {
	cooldown: 60,
	data: new ContextMenuCommandBuilder()
		.setName('Sue in Small Claims')
		.setType(ApplicationCommandType.Message),

	components: {
		'trial-file': handleTrialFiling,
		'trial-vote': handleTrialVote,
	},

	execute: startTrial,
};
