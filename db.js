const Sequelize = require('sequelize');
const { dbName, dbUser, dbPassword } = require('./config.json');

const sequelize = new Sequelize(dbName, dbUser, dbPassword, {
    host: 'localhost',
    dialect: 'postgres',
    logging: false,
});

module.exports = sequelize;