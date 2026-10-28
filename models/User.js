const { economy } = require('../config/settings');

module.exports = (sequelize, DataTypes) => {
  return sequelize.define('User', {
    userId: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    xp: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    level: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    // Bomb Bucks balance (separate from XP)
    coins: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: economy.startingBalance,
    },
    lastMessageTime: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
  });
};
