module.exports = (sequelize, DataTypes) => {
    return sequelize.define('Bet', {
        marketId: {
            type: DataTypes.INTEGER,
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
        choice: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        // Already taken from the bettor's coins when the bet was placed
        wager: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        resolved: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        // Net coin change once resolved (negative for a loss, 0 for a refund)
        payout: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
    }, {
        indexes: [
            { unique: true, fields: ['marketId', 'userId'] },
        ],
    });
};
