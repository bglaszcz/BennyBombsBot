module.exports = (sequelize, DataTypes) => {
	return sequelize.define('outofcontext', {
		quote: {
			type: DataTypes.TEXT,
			allowNull: false,
		},
		quotedUserId: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		quotedUsername: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		addedByUserId: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		addedByUsername: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		guildId: {
			type: DataTypes.STRING,
			allowNull: false,
		},
	});
};
