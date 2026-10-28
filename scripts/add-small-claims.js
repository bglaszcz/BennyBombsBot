/**
 * One-off migration for Small Claims Court: adds the money columns to Trials.
 * Existing trials get 0 damages and keep working the old way. Safe to re-run.
 *
 *   node scripts/add-small-claims.js
 */
const { DataTypes } = require('sequelize');
const { sequelize, Trial } = require('../models');

const COLUMNS = {
    damages: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    courtFee: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    awarded: { type: DataTypes.INTEGER, allowNull: true },
    grievance: { type: DataTypes.TEXT, allowNull: true },
};

(async () => {
    const queryInterface = sequelize.getQueryInterface();
    try {
        const table = { tableName: Trial.getTableName().tableName || Trial.getTableName(), schema: 'bennybombsbot' };
        const existing = await queryInterface.describeTable(table);
        for (const [name, definition] of Object.entries(COLUMNS)) {
            if (existing[name]) continue;
            await queryInterface.addColumn(table, name, definition);
            console.log(`➕ Added Trials.${name}`);
        }
        console.log('✅ Small claims court is open for business');
    }
    catch (error) {
        console.error('❌ Migration failed:', error);
        process.exitCode = 1;
    }
    finally {
        await sequelize.close();
    }
})();
