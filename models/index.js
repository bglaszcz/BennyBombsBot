/**
 * Single registry for every Sequelize model. Require this instead of
 * calling a model factory yourself, so each model is defined exactly once.
 *
 *   const { WordleScore, User } = require('../models');
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../db.js');

const models = {
    Bet: require('./Bet')(sequelize, DataTypes),
    BetMarket: require('./BetMarket')(sequelize, DataTypes),
    BootJaf: require('./BootJaf')(sequelize, DataTypes),
    BotState: require('./BotState')(sequelize, DataTypes),
    DethToot: require('./DethToot')(sequelize, DataTypes),
    DethTootLog: require('./DethTootLog')(sequelize, DataTypes),
    DoesRynBill: require('./DoesRynBill')(sequelize, DataTypes),
    GACMessage: require('./GACMessage')(sequelize, DataTypes),
    GMCMessage: require('./GMCMessage')(sequelize, DataTypes),
    LevelUpMessage: require('./LevelUpMessage')(sequelize, DataTypes),
    MapTapScore: require('./MapTapScore')(sequelize, DataTypes),
    Nomination: require('./Nomination')(sequelize, DataTypes),
    // Historical name — it now logs Gemini image requests
    OpenAIAPIUsage: require('./OpenAIAPIUsage')(sequelize, DataTypes),
    OutOfContext: require('./OutOfContext')(sequelize, DataTypes),
    StarboardPost: require('./StarboardPost')(sequelize, DataTypes),
    Trial: require('./Trial')(sequelize, DataTypes),
    TrialVote: require('./TrialVote')(sequelize, DataTypes),
    User: require('./User')(sequelize, DataTypes),
    WordleReminderOptIn: require('./WordleReminderOptIn')(sequelize, DataTypes),
    WordleScore: require('./WordleScore')(sequelize, DataTypes),
};

module.exports = { ...models, sequelize };
