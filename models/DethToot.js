module.exports = (sequelize, DataTypes) => {
	return sequelize.define('dethtoot', {
        username: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        lastTootDate: {
            type: DataTypes.DATE,
            allowNull: false,
          },
	});
};