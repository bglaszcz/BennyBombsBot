const fs = require('fs');

module.exports = {
    name: `jafchart`,
    description: 'Show Jaf Fun Flowchart',
    execute(message, args) {

        var images = `./images/jafchart/image1.png`

        try {
            message.channel.send({files: [images]});
        } catch(err) {
            message.channel.send("YOU BROKE IT!!!");
        }
    },
}