module.exports = (sequelize, DataTypes) => {
	return sequelize.define('OpenAIAPIUsage', {
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      },
    prompt: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  });
};