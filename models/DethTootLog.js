// One row per deth toot, so we can count them (DethToot only keeps the latest date)
module.exports = (sequelize, DataTypes) => {
    return sequelize.define('DethTootLog', {
        userId: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        tootedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
    });
};
