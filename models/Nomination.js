module.exports = (sequelize, DataTypes) => {
	return sequelize.define('nomination', {
		awardType: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		year: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		messageLink: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		messageContent: {
			type: DataTypes.TEXT,
			allowNull: false,
		},
		nomineeUserId: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		nomineeUsername: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		nominatorUserId: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		nominatorUsername: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		guildId: {
			type: DataTypes.STRING,
			allowNull: false,
		},
	});
};
