const { SlashCommandBuilder } = require('discord.js');
const { DoesRynBill, sequelize } = require('../../models');

const DENIAL_DELETE_MS = 10 * 60 * 1000;

/** The bill everyone is trying to submit; isNew means nobody has attempted it yet */
async function getCurrentBill() {
    const latest = await DoesRynBill.findOne({
        attributes: [
            'bill_number',
            [sequelize.fn('MAX', sequelize.cast(sequelize.col('billed'), 'integer')), 'billedYN'],
        ],
        group: ['bill_number'],
        order: [['bill_number', 'DESC']],
        raw: true,
    });

    if (!latest) return { billNumber: 1, isNew: true };
    // Once someone lands a bill, the next attempt starts a fresh bill number
    if (Number(latest.billedYN) === 1) return { billNumber: latest.bill_number + 1, isNew: true };
    return { billNumber: latest.bill_number, isNew: false };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('doesrynbill')
        .setDescription('doesrynbill!')
        .addIntegerOption(option => option
            .setName('guess')
            .setDescription('What number are you guessing 1-100?')
            .setMaxValue(100)
            .setMinValue(1)
            .setRequired(true)),
    async execute(interaction) {
        const guess = interaction.options.getInteger('guess');
        const billHours = Math.round(Math.random() * 100) / 10;
        const rando = Math.floor(Math.random() * 100) + 1;
        const billed = guess === rando;
        const { username } = interaction.user;

        const { billNumber, isNew } = await getCurrentBill();

        // A brand-new bill has no previous attempts; an in-progress one may
        const attempter = isNew ? null : await DoesRynBill.findOne({
            where: { username, billed: false, bill_number: billNumber },
        });

        const attempts = (attempter ? Number(attempter.attempts) : 0) + 1;
        const hours = Math.round(((attempter ? Number(attempter.hours) : 0) + billHours) * 10) / 10;

        if (attempter) {
            await attempter.update({ attempts, hours, billed });
        }
        else {
            await DoesRynBill.create({ username, attempts, hours, bill_number: billNumber, billed });
        }

        if (billed) {
            return interaction.reply(`ryn did a bill! ${username} submitted ${attempts} bills for ${hours} hours on his behalf. 🧾✅`);
        }

        const response = await interaction.reply({
            content: `ryn submitted a bill for ${billHours} hours and was denied. ${username} has tried to submit ${attempts} bills for him. (${rando})`,
            withResponse: true,
        });
        setTimeout(() => response.resource.message.delete().catch(() => {}), DENIAL_DELETE_MS);
    },
};
