module.exports = (sequelize, DataTypes) => {
    return sequelize.define('Trial', {
        // The message on trial — each message can only be tried once
        targetMessageId: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        targetUrl: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        quote: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        defendantId: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        accuserId: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        charge: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        // The bot's courtroom post with the voting buttons
        channelId: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        messageId: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        // open | closed
        status: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'open',
        },
        // guilty | innocent | mistrial
        verdict: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        closesAt: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    });
};
