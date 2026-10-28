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
        // Small claims: what the plaintiff asked for, the fee they paid to file (held until
        // the verdict) and what the court actually collected. 0 on trials from before money.
        damages: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        courtFee: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        awarded: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        grievance: {
            type: DataTypes.TEXT,
            allowNull: true,
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
        // guilty (liable) | innocent (not liable) | mistrial
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
