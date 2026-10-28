const { BotState } = require('../models');

async function getState(key, fallback = null) {
    const row = await BotState.findByPk(key);
    return row ? row.value : fallback;
}

async function setState(key, value) {
    await BotState.upsert({ key, value });
}

module.exports = { getState, setState };
