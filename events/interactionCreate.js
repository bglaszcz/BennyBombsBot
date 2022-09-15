module.exports = {
	name: 'interactionCreate',
	execute(interaction) {
		console.log(`${interaction.user.tag} in ${interaction.guild.name} channel #${interaction.channel.name} triggered an interaction.`);
	},
};