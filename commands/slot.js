const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
// Define the Tenor API key
const { tenorApiKey } = require('../config.json');

// Define an array to keep track of users using the /slot command
let slotUsers = [null, null, null, null]; // Initialize with 4 null slots
let inactivityTimer;
// Define the maximum wait time in milliseconds
const maxWaitTime = 120000; // 2 minutes

// Define the URL of the specified image
const specifiedImageUrl = 'https://cdn.discordapp.com/attachments/771095355077033996/1046879683259678781/IMG_1200.jpg';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slot')
    .setDescription('Use the /slot command to join a slot game.'),
  async execute(interaction) {
    const user = interaction.user.username;

    // Reset the inactivity timer if it's empty
    if (slotUsers.every(slot => slot === null)) {
      clearTimeout(inactivityTimer);
    }

    // Check if the user has already used the /slot command
    // if (slotUsers.includes(user)) {
    //   await interaction.reply({ content: 'You have already used the /slot command.', ephemeral: true });
    //   return;
    // }

    // Defer the reply to avoid "InteractionNotReplied" error
    await interaction.deferReply();

    // Find the first empty slot and fill it with the user's name
    const emptySlotIndex = slotUsers.indexOf(null);
    if (emptySlotIndex !== -1) {
      slotUsers[emptySlotIndex] = user;
    }

    // Check if all slots are filled
    if (!slotUsers.includes(null) && slotUsers.length === 4) {
      // Clear the list of users
      slotUsers = [null, null, null, null];

      // Retrieve a random GIF from Tenor API
      try {
        const url = `https://g.tenor.com/v1/search?q=stuffed&key=${tenorApiKey}&limit=50`;
        const response = await fetch(url);
        const json = await response.json();

        const index = Math.floor(Math.random() * json.results.length);
        

        // const embed = new EmbedBuilder()
        //   .setURL(
        //         {value: `${json.results[index].url}`},
        //         {value: `${specifiedImageUrl}`},
        //     ); // Set the image URL as the image in the embed
        // await interaction.followUp(embed);
        await interaction.followUp(`${specifiedImageUrl}`);
        await interaction.followUp(`${json.results[index].url}`);
      } catch (error) {
        console.error('Error fetching GIF from Tenor:', error);
        await interaction.followUp('An error occurred while selecting a random GIF.');
      }

      // Send the specified image
      
    } else {
      // Display the slots with user names and placeholders
      const slotDisplay = slotUsers.map((slot, index) => `--${slot || `Slot${index + 1}`}--`).join('/');
      await interaction.followUp(`Current slots: (${slotDisplay})`);
    }

    // Set a timeout to remove the user from the list if they don't use /slot again within 2 minutes
    inactivityTimer = setTimeout(() => {
      slotUsers = [null, null, null, null]; // Clear the array
      interaction.followUp({content:`All slots have been cleared due to inactivity.`, ephemeral: true });
    }, maxWaitTime);
  },
};
