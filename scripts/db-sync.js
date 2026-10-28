/**
 * Apply model column changes to the database (sequelize.sync({ alter: true })).
 * The bot itself only creates missing tables on startup; run this after you
 * add or change a column:  npm run db:sync
 */
const { sequelize } = require('../models');

(async () => {
    try {
        await sequelize.sync({ alter: true });
        console.log('✅ Database schema altered to match the models.');
    }
    catch (error) {
        console.error('❌ Schema sync failed:', error);
        process.exitCode = 1;
    }
    finally {
        await sequelize.close();
    }
})();
