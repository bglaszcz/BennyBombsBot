const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ComponentType,
} = require('discord.js');
const userMemory = require('../../services/userMemory');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('memory')
    .setDescription('Manage what the bot remembers')
    .addSubcommand(sub =>
      sub
        .setName('view')
        .setDescription('View what the bot remembers about you or someone else')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to check memories for (leave blank for yourself)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('forget')
        .setDescription('Make the bot forget a specific fact or preference')
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('What type of memory to forget')
            .setRequired(true)
            .addChoices(
              { name: 'Fact', value: 'fact' },
              { name: 'Preference', value: 'preference' }
            )
        )
        .addStringOption(option =>
          option
            .setName('item')
            .setDescription('The exact fact text or preference category name (leave blank to pick from a list)')
            .setRequired(false)
        )
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('(Admin) Remove a memory for another user')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('reload')
        .setDescription('(Admin) Force a reload from disk (hand edits are normally picked up within seconds)')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'view') {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const summary = userMemory.getMemorySummary(targetUser.id);

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`🧠 Memory Bank: ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL());

      embed.addFields({
        name: '📊 Stats',
        value: `Messages: ${summary.messageCount}\nDays known: ${summary.daysSinceFirstSeen}\nRoast Score: ${summary.roastScore > 0 ? '+' : ''}${summary.roastScore}`,
        inline: false
      });

      if (summary.facts.length > 0) {
        embed.addFields({
          name: '📝 Things I Remember',
          value: summary.facts.map(f => `• ${f}`).join('\n'),
          inline: false
        });
      }

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

      if (summary.insideJokes.length > 0) {
        embed.addFields({
          name: '😂 Inside Jokes',
          value: summary.insideJokes.join(', '),
          inline: false
        });
      }

      if (summary.achievements.length > 0) {
        embed.addFields({
          name: '🎯 Achievements',
          value: summary.achievements.map(a => `🏆 ${a.name}`).join('\n'),
          inline: false
        });
      }

      if (summary.messageCount === 0) {
        embed.setDescription("I don't know this person yet! They're basically a stranger to me 👀");
      }

      await interaction.reply({ embeds: [embed] });

    } else if (sub === 'forget') {
      const type = interaction.options.getString('type');
      const item = interaction.options.getString('item');
      const targetUser = interaction.options.getUser('user');

      // Targeting another user requires admin permission
      if (targetUser && targetUser.id !== interaction.user.id) {
        const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
        if (!isAdmin) {
          await interaction.reply({ content: 'You need the **Manage Server** permission to modify someone else\'s memories.', flags: MessageFlags.Ephemeral });
          return;
        }
      }

      const userId = targetUser ? targetUser.id : interaction.user.id;
      const targetLabel = targetUser && targetUser.id !== interaction.user.id ? `${targetUser.username}'s` : 'your';

      if (item) {
        // Typed-text flow (unchanged)
        let removed;
        if (type === 'fact') {
          removed = userMemory.removeFact(userId, item);
        } else {
          removed = userMemory.removePreference(userId, item);
        }

        if (removed) {
          await interaction.reply({ content: `Got it — I've removed that ${type} from ${targetLabel} memory: **${item}**`, flags: MessageFlags.Ephemeral });
        } else {
          await interaction.reply({
            content: `I couldn't find a ${type} matching **"${item}"** in ${targetLabel} memory. Use \`/memory view\` to see the exact text/category names.`,
            flags: MessageFlags.Ephemeral
          });
        }
        return;
      }

      // No item given — show a select menu to pick from instead of typing
      const memory = userMemory.getUserMemory(userId);
      const options = type === 'fact'
        ? memory.facts.map((f, i) => ({ key: String(i), text: typeof f === 'string' ? f : f.text }))
        : Object.entries(memory.preferences).map(([category, pref]) => ({
            key: category,
            text: `${category}: ${typeof pref === 'string' ? pref : pref.value}`
          }));

      if (options.length === 0) {
        await interaction.reply({ content: `${targetLabel} memory has no ${type}s to forget.`, flags: MessageFlags.Ephemeral });
        return;
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('memory-forget-select')
        .setPlaceholder(`Select ${type}(s) to forget`)
        .setMinValues(1)
        .setMaxValues(options.length)
        .addOptions(options.map(opt => ({
          label: opt.text.length > 100 ? `${opt.text.slice(0, 97)}...` : opt.text,
          value: opt.key
        })));

      const row = new ActionRowBuilder().addComponents(selectMenu);

      await interaction.reply({
        content: `Select the ${type}(s) to forget from ${targetLabel} memory:`,
        components: [row],
        flags: MessageFlags.Ephemeral
      });

      const message = await interaction.fetchReply();
      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: i => i.user.id === interaction.user.id,
        time: 60_000,
        max: 1
      });

      collector.on('collect', async i => {
        const removedLabels = [];
        i.values.forEach(key => {
          const opt = options.find(o => o.key === key);
          if (!opt) return;
          const removed = type === 'fact'
            ? userMemory.removeFact(userId, opt.text)
            : userMemory.removePreference(userId, opt.key);
          if (removed) removedLabels.push(opt.text);
        });

        await i.update({
          content: removedLabels.length > 0
            ? `Got it — removed ${removedLabels.length} ${type}(s) from ${targetLabel} memory:\n${removedLabels.map(l => `• ${l}`).join('\n')}`
            : `Couldn't remove the selected ${type}(s) — they may have already been removed.`,
          components: []
        });
      });

      collector.on('end', collected => {
        if (collected.size === 0) {
          interaction.editReply({ content: 'Selection timed out.', components: [] }).catch(() => {});
        }
      });

    } else if (sub === 'reload') {
      const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
      if (!isAdmin) {
        await interaction.reply({ content: 'You need the **Manage Server** permission to reload memories.', flags: MessageFlags.Ephemeral });
        return;
      }

      const ok = userMemory.reloadMemories();
      await interaction.reply({
        content: ok
          ? 'Memory reloaded from disk.'
          : 'userMemories.json is not valid JSON right now, so nothing was reloaded. Fix the file and it will be picked up automatically.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
