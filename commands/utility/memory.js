const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const userMemory = require('../userMemory');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('memory')
    .setDescription('View what the bot remembers about you or someone else')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to check memories for (leave blank for yourself)')
        .setRequired(false)
    ),
  
  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const summary = userMemory.getMemorySummary(targetUser.id);

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`🧠 Memory Bank: ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL());

    // Basic stats
    embed.addFields({
      name: '📊 Stats',
      value: `Messages: ${summary.messageCount}\nDays known: ${summary.daysSinceFirstSeen}\nRoast Score: ${summary.roastScore > 0 ? '+' : ''}${summary.roastScore}`,
      inline: false
    });

    // Facts
    if (summary.facts.length > 0) {
      embed.addFields({
        name: '📝 Things I Remember',
        value: summary.facts.map(f => `• ${f}`).join('\n') || 'Nothing yet!',
        inline: false
      });
    }

    // Preferences
    if (Object.keys(summary.preferences).length > 0) {
      const prefText = Object.entries(summary.preferences)
        .map(([key, val]) => `${key}: ${val}`)
        .join('\n');
      embed.addFields({
        name: '❤️ Preferences',
        value: prefText,
        inline: false
      });
    }

    // Inside jokes
    if (summary.insideJokes.length > 0) {
      embed.addFields({
        name: '😂 Inside Jokes',
        value: summary.insideJokes.join(', '),
        inline: false
      });
    }

    // Achievements
    if (summary.achievements.length > 0) {
      const achievementText = summary.achievements
        .map(a => `🏆 ${a.name}`)
        .join('\n');
      embed.addFields({
        name: '🎯 Achievements',
        value: achievementText,
        inline: false
      });
    }

    if (summary.messageCount === 0) {
      embed.setDescription("I don't know this person yet! They're basically a stranger to me 👀");
    }

    await interaction.reply({ embeds: [embed] });
  },
};