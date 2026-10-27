module.exports = (sequelize, DataTypes) => {
	return sequelize.define('dethtoot', {
        // Nullable: rows from before userId was tracked may lack it
        userId: {
            type: DataTypes.STRING,
            allowNull: true,
        },
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