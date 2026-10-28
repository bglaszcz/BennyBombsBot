module.exports = (sequelize, DataTypes) => {
    return sequelize.define('TrialVote', {
        trialId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        userId: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        // guilty | innocent
        vote: {
            type: DataTypes.STRING,
            allowNull: false,
        },
    }, {
        indexes: [
            { unique: true, fields: ['trialId', 'userId'] },
        ],
    });
};
