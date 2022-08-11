const fs = require('fs');

module.exports = {
    name: 'doesrynbill',
    description: 'doesrynbill!',
    execute(message, args) {

        var hours = Math.round((Math.random() * 10) * 10) / 10;
        var rando = Math.floor(Math.random() * 100) + 1;
        
        try {
            var fileAttempts = fs.readFileSync(`./bootjaf/doesrynbillAttempts.txt`, {"encoding":"utf-8"});
            var fileHours = fs.readFileSync(`./bootjaf/doesrynbillHours.txt`, {"encoding":"utf-8"});
            var fileHoursFormat = Number(fileHours).toFixed(2);

            if (rando == 69) {
                message.channel.send(`ryn billed ${hours} hours! ryn tried to submit ${fileAttempts} bills for ${fileHoursFormat} hours before he did a bill.`)
                var writeAttempts = fs.writeFileSync(`./bootjaf/doesrynbillAttempts.txt`, `0`);
                var writeHours = fs.writeFileSync(`./bootjaf/doesrynbillHours.txt`, `0`);
            }
            else {
                message.channel.send(`ryn submitted ${hours} hours of billed time. DENIED`);
                fileAttempts++;
                var newHours = ((Number(fileHours) + hours) * 10) / 10;
                var newHoursFormatted = Number(newHours).toFixed(2);
                var writeAttempts = fs.writeFileSync(`./bootjaf/doesrynbillAttempts.txt`, `${fileAttempts}`);
                var writeHours = fs.writeFileSync(`./bootjaf/doesrynbillHours.txt`, `${newHoursFormatted}`);
                
            }
        } catch (err) {
            console.error(err);
        }
    },
}