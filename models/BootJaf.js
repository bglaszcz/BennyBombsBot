module.exports = (sequelize, DataTypes) => {
	return sequelize.define('bootjaf', {
        // Nullable: rows from before userId was tracked may lack it
        userId: DataTypes.STRING,
        username: DataTypes.STRING,
        usage_count: {
            type: DataTypes.INTEGER,
            defaultValue: 432,
            allowNull: false,
        },
	});
};