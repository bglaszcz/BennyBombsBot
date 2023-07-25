// const { InteractionCollector } = require('discord.js');
const Sequelize = require('sequelize');
const sequelize = require('./db.js');

// const BootJaf = require('./models/BootJaf.js')(sequelize, Sequelize.DataTypes);
const DoesRynBill = require('./models/DoesRynBill.js')(sequelize, Sequelize.DataTypes);

const force = process.argv.includes('--force') || process.argv.includes('-f');

DoesRynBill.sync();

sequelize.sync({ force }).then(async () => {
	const doesrynbill = [
		DoesRynBill.upsert({ username: 'BennyBombs',
							attempts: 1,
							hours: 1,
							bill_number: 1,
							billed: "f" }),
	];

	await Promise.all(doesrynbill);
	console.log('Database synced');

	sequelize.close();
}).catch(console.error);