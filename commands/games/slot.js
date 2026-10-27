const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { randomGif } = require('../../utils/giphy');

const SLOT_COUNT = 4;
// Slots clear if nobody joins for this long
const INACTIVITY_MS = 2 * 60 * 1000;
const JACKPOT_IMAGE_URL = 'https://cdn.discordapp.com/attachments/771095355077033996/1046879683259678781/IMG_1200.jpg';

let slotUsers = [];
let inactivityTimer = null;

function resetSlots() {
  slotUsers = [];
  clearTimeout(inactivityTimer);
  inactivityTimer = null;
}

function slotDisplay() {
  return Array.from({ length: SLOT_COUNT }, (_, i) => `--${slotUsers[i]?.username || `Slot${i + 1}`}--`).join('/');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slot')
    .setDescription('Use the /slot command to join a slot game.'),
  async execute(interaction) {
    if (slotUsers.some(u => u.id === interaction.user.id)) {
      return interaction.reply({ content: "You're already in a slot. Wait for the others! 🎰", flags: MessageFlags.Ephemeral });
    }

    slotUsers.push({ id: interaction.user.id, username: interaction.user.username });

    if (slotUsers.length < SLOT_COUNT) {
      // Every join restarts the inactivity clock
      clearTimeout(inactivityTimer);
      const channel = interaction.channel;
      inactivityTimer = setTimeout(() => {
        resetSlots();
        channel.send('🎰 All slots have been cleared due to inactivity.').catch(() => {});
      }, INACTIVITY_MS);

      return interaction.reply(`Current slots: (${slotDisplay()})`);
    }

    // All slots filled — jackpot
    resetSlots();
    await interaction.reply(JACKPOT_IMAGE_URL);

    try {
      const gif = await randomGif('stuffed');
      if (gif) await interaction.followUp(gif.url);
    }
    catch (error) {
      console.error('Error fetching GIF from Giphy:', error);
    }
  },
};
