module.exports = (sequelize, DataTypes) => {
	return sequelize.define('OpenAIAPIUsage', {
    // Nullable: rows from before userId was tracked may lack it
    userId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
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