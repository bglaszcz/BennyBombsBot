/**
 * One-off migration: add the userId column to tables that used to store only
 * a username, then fill it in by matching usernames against the Users table.
 * Safe to re-run — it only touches rows whose userId is still null.
 *
 *   node scripts/backfill-user-ids.js
 */
const { DataTypes } = require('sequelize');
const { sequelize, BootJaf, DethToot, GACMessage, GMCMessage, OpenAIAPIUsage } = require('../models');

const SCHEMA = 'bennybombsbot';
const MODELS = [BootJaf, DethToot, GACMessage, GMCMessage, OpenAIAPIUsage];

(async () => {
    const queryInterface = sequelize.getQueryInterface();
    try {
        for (const model of MODELS) {
            const table = { tableName: model.getTableName().tableName || model.getTableName(), schema: SCHEMA };
            const columns = await queryInterface.describeTable(table);
            if (!columns.userId) {
                await queryInterface.addColumn(table, 'userId', { type: DataTypes.STRING, allowNull: true });
                console.log(`➕ Added userId to ${table.tableName}`);
            }

            const [, result] = await sequelize.query(
                `UPDATE "${SCHEMA}"."${table.tableName}" t
                 SET "userId" = u."userId"
                 FROM "${SCHEMA}"."Users" u
                 WHERE t."userId" IS NULL AND t.username = u.username`,
            );
            const [[{ missing }]] = await sequelize.query(
                `SELECT COUNT(*) AS missing FROM "${SCHEMA}"."${table.tableName}" WHERE "userId" IS NULL`,
            );
            console.log(`✅ ${table.tableName}: backfilled ${result.rowCount} row(s), ${missing} still without a userId`);
        }
    }
    catch (error) {
        console.error('❌ Backfill failed:', error);
        process.exitCode = 1;
    }
    finally {
        await sequelize.close();
    }
})();
