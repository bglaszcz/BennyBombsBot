module.exports = (sequelize, DataTypes) => {
	return sequelize.define('doesrynbill', {
        username: DataTypes.STRING,
        attempts: DataTypes.INTEGER,
        hours: DataTypes.DECIMAL,
        bill_number: DataTypes.INTEGER,
        billed: DataTypes.BOOLEAN,
	});
};