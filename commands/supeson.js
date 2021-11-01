
const fs = require('fs');
const imageFiles = fs.readdirSync('./images/supeson');

module.exports = {
    name: `supeson`,
    description: 'GOOD MORNING CREW',
    execute(message, args) {
        message.delete();
        var images = new Array();
        var i = 0;
        for (const file of imageFiles) {
            images[i] = `./images/supeson/${file}`;
            i++;
        }
        var number = Math.floor(Math.random()*images.length);
        try {
            message.channel.send({files: [images[number]]});
        } catch(err) {
            message.channel.send("YOU BROKE IT!!!");
        }
    },
}