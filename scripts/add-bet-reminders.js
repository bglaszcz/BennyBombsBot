/**
 * One-off migration for custom bet settle reminders and disputes: adds
 * BetMarkets.settleAt, remindedAt and proposal. Safe to re-run.
 *
 *   node scripts/add-bet-reminders.js
 */
const { DataTypes } = require('sequelize');
const { sequelize, BetMarket } = require('../models');

const COLUMNS = {
    settleAt: { type: DataTypes.DATE, allowNull: true },
    remindedAt: { type: DataTypes.DATE, allowNull: true },
    proposal: { type: DataTypes.JSON, allowNull: true },
};

(async () => {
    const queryInterface = sequelize.getQueryInterface();
    try {
        const table = { tableName: BetMarket.getTableName().tableName || BetMarket.getTableName(), schema: 'bennybombsbot' };
        const existing = await queryInterface.describeTable(table);
        for (const [name, definition] of Object.entries(COLUMNS)) {
            if (existing[name]) continue;
            await queryInterface.addColumn(table, name, definition);
            console.log(`➕ Added BetMarkets.${name}`);
        }
        console.log('✅ Bet settle reminders ready');
    }
    catch (error) {
        console.error('❌ Migration failed:', error);
        process.exitCode = 1;
    }
    finally {
        await sequelize.close();
    }
})();
