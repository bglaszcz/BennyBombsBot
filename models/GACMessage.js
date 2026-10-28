module.exports = (sequelize, DataTypes) => {
  const GACMessage = sequelize.define('GACMessage', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    date: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true, // Ensures only one GAC message per day
    },
    // Nullable: rows from before userId was tracked may lack it
    userId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    emojis: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    excuse: {
      type: DataTypes.TEXT, // Using TEXT for longer excuse content
      allowNull: false,
    },
    // Betting category (services/gacBets CATEGORIES), classified when the excuse is posted
    category: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'gac_messages',
    timestamps: true,
  });

  return GACMessage;
};