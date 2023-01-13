const Sequelize = require('sequelize');
const { dbName, dbUser, dbPassword } = require('/home/ben/Desktop/BennyBombsBot/config.json');

const sequelize = new Sequelize(dbName, dbUser, dbPassword, {
    host: 'localhost',
    dialect: 'postgres',
    logging: false,
});

module.exports = sequelize;