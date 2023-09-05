module.exports = (sequelize, DataTypes) => {
	return sequelize.define('GMCMessage', {
    date: {
      type: DataTypes.DATE, // You can adjust the data type if needed
      allowNull: false,
      unique: true,
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