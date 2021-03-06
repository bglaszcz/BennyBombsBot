require("dotenv").config();

const Discord = require("discord.js");
const prefix = "!";

const discord = {
  /**
   * Gets the current number of Online Users on the server.
   * @param users A Collection of all users
   * @returns The number of online users
   */
  getOnlineUsers: users =>
    users.cache.filter(user => user.presence.status !== "offline" && !user.bot).size,

  /**
   * Gets the first command from the message that was sent.
   * @param message A message object
   * @return The command that was issued
   */
  getCommand: message => {
    const args = message.content
      .slice(prefix.length)
      .trim()
      .split(/ +/g);
    return args.shift().toLowerCase();
  },

  /**
   * Gets the total number of voice channels in the server.
   * @param channels A collection of server channels
   * @return The number of voice channels
   */
  getVoiceChannels: channels =>
    channels.cache.filter(channel => channel.type === "voice").size,

  /**
   * Gets the number of text channels in the server.
   * @param channels A collection of server channels
   * @return The number of text channels
   */
  getTextChannels: channels =>
    channels.cache.filter(channel => channel.type === "text").size
};

const helpers = {
  /**
   * A simple function for converting the timestamp to a
   * readable format.
   * @param time A Discord timestamp
   * @return A string of the Date and Time
   */
  convertTime: time => new Date(time).toString()
};

const arrayToSentence = arr => {
  let last = arr.pop();
  return arr.join(', ') + ' or ' + last;
}

module.exports = {
  discord,
  helpers,
  arrayToSentence
};