const fs = require('fs');
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName(`doesrynbill`)
        .setDescription(`doesrynbill!`),
    execute(interaction) {

        const hours = Math.round((Math.random() * 10) * 10) / 10;
        const rando = Math.floor(Math.random() * 100) + 1;

        try {
            let fileAttempts = fs.readFileSync(`./bootjaf/doesrynbillAttempts.txt`, { "encoding":"utf-8" });
            const fileHours = fs.readFileSync(`./bootjaf/doesrynbillHours.txt`, { "encoding":"utf-8" });
            const fileHoursFormat = Number(fileHours).toFixed(2);

            if (rando == 69) {
                interaction.reply(`ryn billed ${hours} hours! ryn tried to submit ${fileAttempts} bills for ${fileHoursFormat} hours before he did a bill.`);
                fs.writeFileSync(`./bootjaf/doesrynbillAttempts.txt`, `0`);
                fs.writeFileSync(`./bootjaf/doesrynbillHours.txt`, `0`);
            }
            else {
                interaction.reply(`ryn submitted ${hours} hours of billed time. DENIED`);
                fileAttempts++;
                const newHours = ((Number(fileHours) + hours) * 10) / 10;
                const newHoursFormatted = Number(newHours).toFixed(2);
                fs.writeFileSync(`./bootjaf/doesrynbillAttempts.txt`, `${fileAttempts}`);
                fs.writeFileSync(`./bootjaf/doesrynbillHours.txt`, `${newHoursFormatted}`);

            }
        }
        catch (err) {
            console.error(err);
        }
    },
};