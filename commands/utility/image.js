const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { Op } = require('sequelize');
const { OpenAIAPIUsage } = require('../../models');
const { generateImage, SafetyBlockError } = require('../../services/gemini');
const { image: imageSettings } = require('../../config/settings');

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

module.exports = {
  // Seconds between uses per user — each generation costs money
  cooldown: 30,
  data: new SlashCommandBuilder()
    .setName('image')
    .setDescription('Generate an image from a prompt')
    .addStringOption(option => option
      .setName('prompt')
      .setDescription('The prompt for generating the image')
      .setRequired(true)),
  async execute(interaction) {
    const userPrompt = interaction.options.getString('prompt');

    const usedToday = await OpenAIAPIUsage.count({
      where: {
        username: interaction.user.username,
        type: 'image',
        createdAt: { [Op.gte]: startOfToday() },
      },
    });
    if (usedToday >= imageSettings.dailyLimitPerUser) {
      return interaction.reply(`You've hit today's limit of ${imageSettings.dailyLimitPerUser} images. Your GPU budget resets at midnight. 🎨`);
    }

    await interaction.deferReply();

    try {
      const buffer = await generateImage(userPrompt);
      if (!buffer) {
        return interaction.editReply('Failed to generate an image.');
      }

      await OpenAIAPIUsage.create({
        username: interaction.user.username,
        prompt: userPrompt.slice(0, 255),
        type: 'image',
      });

      const attachment = new AttachmentBuilder(buffer, { name: 'image.png' });
      const embed = new EmbedBuilder()
        .setImage('attachment://image.png')
        .setFooter({ text: userPrompt.slice(0, 2048) });

      await interaction.editReply({ embeds: [embed], files: [attachment] });
    }
    catch (error) {
      console.error('Image generation failed:', error);
      const message = error instanceof SafetyBlockError
        ? "Gemini refused to draw that one. Try something a little less cursed. 🙈"
        : 'Image generation failed. Try again in a bit. 😵';
      await interaction.editReply(message);
    }
  },
};
