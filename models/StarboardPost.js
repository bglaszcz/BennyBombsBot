module.exports = (sequelize, DataTypes) => {
    return sequelize.define('StarboardPost', {
        messageId: {
            type: DataTypes.STRING,
            primaryKey: true,
        },
        channelId: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        authorId: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        starboardMessageId: {
            type: DataTypes.STRING,
            allowNull: true,
        },
    });
};
