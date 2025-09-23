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