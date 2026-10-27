module.exports = (sequelize, DataTypes) => {
    return sequelize.define('GACBet', {
        // Same utils/dayKey key GACMessage uses
        date: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        userId: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        category: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        wager: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        resolved: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        payout: {
            // Net XP change once resolved (negative for a loss)
            type: DataTypes.INTEGER,
            allowNull: true,
        },
    }, {
        indexes: [
            { unique: true, fields: ['date', 'userId'] },
        ],
    });
};
