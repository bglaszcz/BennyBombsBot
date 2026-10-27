const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BootJaf } = require('../../models');
const { randomGif } = require('../../utils/giphy');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('bootjaf')
		.setDescription('Count the times we boot jaf'),
    async execute(interaction) {
        await interaction.deferReply();

        const bootJafCount = await BootJaf.findOne({
            order: [ [ 'createdAt', 'DESC' ] ],
        });

        const bootJafCountDisplay = (bootJafCount?.usage_count ?? 0) + 1;

        const isDevilCount = bootJafCountDisplay === 666;

        try {
            await BootJaf.create({
                userId: interaction.user.id,
                username: interaction.user.username,
                usage_count: bootJafCountDisplay,
            });
        }
        catch (error) {
            console.log(error);
        }

        const embed = new EmbedBuilder()
            .setColor(isDevilCount ? 0x8B0000 : 0xFFFFFF)
            .setTitle(isDevilCount ? `😈 ${bootJafCountDisplay} 😈` : `${bootJafCountDisplay}`);

        if (isDevilCount) {
            embed.setDescription('The number of the beast has been reached. Jaf has been booted straight to hell.');
        }

        try {
            const gif = await randomGif(isDevilCount ? 'satan' : 'milk');
            if (gif) embed.setImage(gif.imageUrl);
        }
        catch (error) {
            console.log(error);
        }

        await interaction.editReply({ embeds: [embed] });
    },
};
