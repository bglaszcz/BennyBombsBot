/**
 * One-off migration for Bomb Bucks: adds User.coins (existing users get the
 * starting balance via the column default) and creates the betting and trial
 * tables. Safe to re-run.
 *
 *   node scripts/add-economy.js
 */
const { DataTypes } = require('sequelize');
const { sequelize, User, BetMarket, Bet, Trial, TrialVote } = require('../models');
const { economy } = require('../config/settings');

(async () => {
    const queryInterface = sequelize.getQueryInterface();
    try {
        const table = { tableName: User.getTableName().tableName || User.getTableName(), schema: 'bennybombsbot' };
        const columns = await queryInterface.describeTable(table);
        if (!columns.coins) {
            await queryInterface.addColumn(table, 'coins', {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: economy.startingBalance,
            });
            console.log(`➕ Added Users.coins — everyone starts with ${economy.startingBalance}`);
        }

        for (const model of [BetMarket, Bet, Trial, TrialVote]) await model.sync();
        console.log('✅ Betting and trial tables ready');
    }
    catch (error) {
        console.error('❌ Migration failed:', error);
        process.exitCode = 1;
    }
    finally {
        await sequelize.close();
    }
})();
