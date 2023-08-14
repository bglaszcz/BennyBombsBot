module.exports = (sequelize, DataTypes) => {
	return sequelize.define('GMCMessage', {
    date: {
      type: DataTypes.STRING, // You can adjust the data type if needed
      allowNull: false,
      unique: true,
    },
    emojis: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  });
};