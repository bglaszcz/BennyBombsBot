const Sequelize = require('sequelize');
const { dbName, dbUser, dbPassword } = require('/home/ben/Desktop/BennyBombsBot/config.json');

const sequelize = new Sequelize(dbName, dbUser, dbPassword, {
    host: '192.168.1.35',
    dialect: 'postgres',
    logging: false,
});

module.exports = sequelize;