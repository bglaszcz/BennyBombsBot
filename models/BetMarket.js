/**
 * Something people can bet on: today's GAC excuse, a player's Wordle/MapTap
 * score, a deth toot window, or a custom yes/no question.
 */
module.exports = (sequelize, DataTypes) => {
    return sequelize.define('BetMarket', {
        // gac | wordle | maptap | dethtoot | custom
        type: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        // Identifies an automatic market (e.g. "wordle:1955:<userId>") so bets pile into one row; null for custom
        key: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true,
        },
        question: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        // The player a Wordle/MapTap/deth toot market is about
        subjectUserId: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        // Over/under line
        line: {
            type: DataTypes.FLOAT,
            allowNull: true,
        },
        // [{ value, label, multiplier? }] — multiplier is net winnings per coin for fixed-odds markets
        options: {
            type: DataTypes.JSON,
            allowNull: false,
        },
        // fixed: pays each option's multiplier | pool: winners split the losers' stakes
        payoutMode: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'fixed',
        },
        // open | locked (no new bets) | settled | void
        status: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'open',
        },
        outcome: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        closesAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        creatorId: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        // Where results get announced, and the custom market's own post
        channelId: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        messageId: {
            type: DataTypes.STRING,
            allowNull: true,
        },
    }, {
        indexes: [
            { fields: ['status'] },
        ],
    });
};
