// Small key/value store for scheduler bookkeeping (last run dates, poll IDs, current champions)
module.exports = (sequelize, DataTypes) => {
    return sequelize.define('BotState', {
        key: {
            type: DataTypes.STRING,
            primaryKey: true,
        },
        value: {
            type: DataTypes.JSON,
            allowNull: true,
        },
    });
};
