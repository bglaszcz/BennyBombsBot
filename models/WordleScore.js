module.exports = (sequelize, DataTypes) => {
    return sequelize.define('WordleScore', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        userId: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        wordleNumber: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        score: {
            type: DataTypes.INTEGER, // 1-6 for successful, 7 for X/failed
            allowNull: false,
        },
        hardMode: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        messageId: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        postedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
    }, {
        indexes: [
            {
                unique: true,
                fields: ['userId', 'wordleNumber'], // One score per user per Wordle
            },
            {
                fields: ['wordleNumber'],
            },
            {
                fields: ['postedAt'],
            },
        ],
    });
};
