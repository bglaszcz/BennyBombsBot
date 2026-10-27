module.exports = (sequelize, DataTypes) => {
	return sequelize.define('GMCMessage', {
    date: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
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
  });
};