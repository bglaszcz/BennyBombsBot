module.exports = (sequelize, DataTypes) => {
	return sequelize.define('bootjaf', {
        username: DataTypes.STRING,
        usage_count: {
            type: DataTypes.INTEGER,
            defaultValue: 354,
            allowNull: false,
        },
	});
};