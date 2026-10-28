/**
 * One-off migration: add GACMessage.category and classify every past excuse,
 * so /gacbet odds can be priced from how often each category comes up.
 * Safe to re-run — only classifies rows that don't have a category yet.
 *
 *   node scripts/add-gac-categories.js
 */
const { DataTypes } = require('sequelize');
const { sequelize, GACMessage } = require('../models');
const { classifyExcuse } = require('../services/gacBets');

(async () => {
    const queryInterface = sequelize.getQueryInterface();
    try {
        const table = { tableName: GACMessage.getTableName().tableName || GACMessage.getTableName(), schema: 'bennybombsbot' };
        const columns = await queryInterface.describeTable(table);
        if (!columns.category) {
            await queryInterface.addColumn(table, 'category', { type: DataTypes.STRING, allowNull: true });
            console.log('➕ Added gac_messages.category');
        }

        const rows = await GACMessage.findAll({ where: { category: null } });
        // A few at a time to stay polite to the Gemini API
        for (let i = 0; i < rows.length; i += 10) {
            await Promise.all(rows.slice(i, i + 10).map(async row => {
                await row.update({ category: await classifyExcuse(row.excuse) });
            }));
        }
        console.log(`✅ Classified ${rows.length} excuse(s)`);

        const counts = await GACMessage.count({ group: ['category'] });
        console.log(counts.map(c => `${c.category}: ${c.count}`).join(', '));
    }
    catch (error) {
        console.error('❌ Migration failed:', error);
        process.exitCode = 1;
    }
    finally {
        await sequelize.close();
    }
})();
