module.exports = (sequelize, DataTypes) => {
	return sequelize.define('bootjaf', {
        username: DataTypes.STRING,
        usage_count: {
            type: DataTypes.INTEGER,
            defaultValue: 432,
            allowNull: false,
        },
	});
};