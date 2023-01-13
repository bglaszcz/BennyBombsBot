// const { InteractionCollector } = require('discord.js');
const Sequelize = require('sequelize');
const sequelize = require('./db.js');

const BootJaf = require('./models/BootJaf.js')(sequelize, Sequelize.DataTypes);
// const DoesRynBill = require('./models/DoesRynBill.js')(sequelize, Sequelize.DataTypes);

const force = process.argv.includes('--force') || process.argv.includes('-f');

BootJaf.sync();

sequelize.sync({ force }).then(async () => {
	const bootjaf = [
		BootJaf.upsert({ username: 'BennyBombs',
							usage_count: 432 }),
	];

	await Promise.all(bootjaf);
	console.log('Database synced');

	sequelize.close();
}).catch(console.error);