const { SlashCommandBuilder } = require('discord.js');
const { Sequelize, Op } = require('sequelize');
const sequelize = require('../db.js');

const DoesRynBill = require('../models/DoesRynBill')(sequelize, Sequelize.DataTypes);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('test')
		.setDescription('setting up doesrynbill'),
    async execute(interaction) {

        const billHours = Math.round((Math.random() * 10) * 10) / 10;
        const rando = Math.floor(Math.random() * 100) + 1;

        const bills = await DoesRynBill.findOne({
            attributes: [
            `bill_number`,
            [sequelize.fn('MAX', sequelize.cast(sequelize.col('billed'), 'integer')), 'billedYN'],
            ],
            group: [`bill_number`],
            order: [ ['bill_number', 'DESC'] ],
        });

        let billed;
        let newBillNum;
        let currBillNum;

        if (bills.dataValues.billedYN === 1) {
            billed = 1;
            newBillNum = bills.dataValues.bill_number + 1;
        }
        else {
            billed = 0;
            currBillNum = bills.dataValues.bill_number;
        }

        const attempter = await DoesRynBill.findOne({
            attributes: [
            'id', 'username', 'attempts', 'hours', 'bill_number', 'billed',
            ],
            where: {
                    [Op.and]: [{ username: interaction.user.username }, { billed: false } ] },
        });

        const newHours = Number(attempter.dataValues.hours) || 0 + billHours;
        const newAttempts = Number(attempter.dataValues.attempts) || 0 + 1;

        if (billed === 0) {
            if (attempter.length != 0) {
                if (rando === 69) {
                    try {
                        await DoesRynBill.upsert({
                            id: attempter.dataValues.id,
                            attempts: newAttempts,
                            hours: newHours,
                            billed: true,
                        }),
                    interaction.reply(`ryn did a bill! ${interaction.user.username} submitted ${newAttempts} bills for ${newHours} on his behalf.`);
                    }
                    catch (error) {
                        console.log(error);
                    }
                }
                else {
                    try {
                        await DoesRynBill.upsert({
                            id: attempter.dataValues.id,
                            attempts: newAttempts,
                            hours: newHours,
                        }),
                        interaction.reply(`ryn submitted a bill for ${billHours} and was denied. ${interaction.user.username} has tried to submit ${newAttempts} bills for him.`);
                    }
                    catch (error) {
                        console.log(error);
                    }
                }
            }
            else if (attempter.length === 0) {
                if (rando === 69) {
                    try {
                        await DoesRynBill.create({
                            username: interaction.user.username,
                            attempts: newAttempts,
                            hours: newHours,
                            bill_number: currBillNum,
                            billed: true,
                        }),
                    interaction.reply(`ryn did a bill! ${interaction.user.username} submitted ${newAttempts} bills for ${newHours} on his behalf.`);                
                    }
                    catch (error) {
                        console.log(error);
                    }
                }
            }
        }
        else if (billed === 1) {
            if (rando === 69) {
                try {
                    await DoesRynBill.create({
                        username: interaction.user.username,
                        attempts: newAttempts,
                        hours: newHours,
                        bill_number: newBillNum,
                        billed: true,
                    }),
                interaction.reply(`ryn did a bill! ${interaction.user.username} submitted ${newAttempts} bills for ${newHours} on his behalf.`);
                }
                catch (error) {
                    console.log(error);
                }
            }
            else {
                try {
                    await DoesRynBill.create({
                        username: interaction.user.username,
                        attempts: newAttempts,
                        hours: newHours,
                        bill_number: newBillNum,
                        billed: false,
                    }),
                    interaction.reply(`ryn submitted a bill for ${billHours} and was denied. ${interaction.user.username} has tried to submit ${newAttempts} bills for him.`);
                }
                catch (error) {
                    console.log(error);
                }
            }
        }
    },
};