const { SlashCommandBuilder } = require('discord.js');
const { Sequelize, Op } = require('sequelize');
const sequelize = require('../../db.js');
const DoesRynBill = require('../../models/DoesRynBill')(sequelize, Sequelize.DataTypes);

module.exports = {
    data: new SlashCommandBuilder()
        .setName(`doesrynbill`)
        .setDescription(`doesrynbill!`)
        .addIntegerOption(option => option
            .setName('guess')
            .setDescription('What number are you guessing 1-100?')
            .setMaxValue(100)
            .setMinValue(1)
            .setRequired(true)),
    async execute(interaction) {
        const guess = interaction.options.getInteger('guess');
        const billHours = Math.round((Math.random() * 10) * 10) / 10;
        const rando = Math.floor(Math.random() * 100) + 1;

        try {
            const bills = await DoesRynBill.findOne({
                attributes: [
                    `bill_number`,
                    [sequelize.fn('MAX', sequelize.cast(sequelize.col('billed'), 'integer')), 'billedYN'],
                ],
                group: [`bill_number`],
                order: [['bill_number', 'DESC']],
            });

            const billedYN = bills.getDataValue('billedYN');
            const bill_number = bills.getDataValue('bill_number');

            let billed;
            let newBillNum;
            let currBillNum;
            let newHours;
            let newAttempts;
            let attempter;

            if (billedYN === 1) {
                billed = 1;
                newBillNum = bill_number + 1;
                attempter = null;
            } else {
                billed = 0;
                currBillNum = bill_number;
                attempter = await DoesRynBill.findOne({
                    attributes: ['id', 'username', 'attempts', 'hours', 'bill_number', 'billed'],
                    where: {
                        [Op.and]: [{ username: interaction.user.username }, { billed: false }, {bill_number: currBillNum} ],
                    },
                });
            }

            if (attempter === null) {
                newHours = billHours;
                newAttempts = 1;
            } else {
                newHours = Number(attempter.hours) + billHours;
                newAttempts = Number(attempter.attempts) + 1;
            }

            if (billed === 0) {
                if (attempter != null) {
                    if (guess === rando) {
                        await DoesRynBill.upsert({
                            id: attempter.id,
                            attempts: newAttempts,
                            hours: newHours,
                            billed: true,
                        });
                        return interaction.reply(`ryn did a bill! ${interaction.user.username} submitted ${newAttempts} bills for ${newHours} on his behalf.`);
                    } else {
                        await DoesRynBill.upsert({
                            id: attempter.id,
                            attempts: newAttempts,
                            hours: newHours,
                        });
                        return interaction.reply(`ryn submitted a bill for ${billHours} hours and was denied. ${interaction.user.username} has tried to submit ${newAttempts} bills for him. (${rando})`).then(msg => {
                            setTimeout(() => msg.delete(), 600000)
                          })
                          .catch(/*Your Error handling if the Message isn't returned, sent, etc.*/);
                    }
                } else if (attempter === null) {
                    if (guess === rando) {
                        await DoesRynBill.create({
                            username: interaction.user.username,
                            attempts: newAttempts,
                            hours: newHours,
                            bill_number: currBillNum,
                            billed: true,
                        });
                        return interaction.reply(`ryn did a bill! ${interaction.user.username} submitted ${newAttempts} bills for ${newHours} on his behalf.`);
                    } else {
                        await DoesRynBill.create({
                            username: interaction.user.username,
                            attempts: newAttempts,
                            hours: newHours,
                            bill_number: currBillNum,
                            billed: false,
                        });
                        return interaction.reply(`ryn submitted a bill for ${billHours} hours and was denied. ${interaction.user.username} has tried to submit ${newAttempts} bills for him. (${rando})`).then(msg => {
                            setTimeout(() => msg.delete(), 600000)
                          })
                          .catch(/*Your Error handling if the Message isn't returned, sent, etc.*/);
                    }
                }
            } else if (billed === 1) {
                if (guess === rando) {
                    await DoesRynBill.create({
                        username: interaction.user.username,
                        attempts: newAttempts,
                        hours: newHours,
                        bill_number: newBillNum,
                        billed: true,
                    });
                    return interaction.reply(`ryn did a bill! ${interaction.user.username} submitted ${newAttempts} bills for ${newHours} on his behalf.`);
                } else {
                    await DoesRynBill.create({
                        username: interaction.user.username,
                        attempts: newAttempts,
                        hours: newHours,
                        bill_number: newBillNum,
                        billed: false,
                    });
                    return interaction.reply(`ryn submitted a bill for ${billHours} hours and was denied. ${interaction.user.username} has tried to submit ${newAttempts} bills for him. (${rando})`).then(msg => {
                        setTimeout(() => msg.delete(), 600000)
                      })
                      .catch(/*Your Error handling if the Message isn't returned, sent, etc.*/);
                }
            }
        } catch (error) {
            console.error(error);
        }
    },
};
