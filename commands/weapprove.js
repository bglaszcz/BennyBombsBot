const fs = require('fs');

module.exports = {
    name: `weapprove`,
    description: 'Your supes approve',
    execute(message, args) {
        message.delete();
        var images = `./images/weapprove/image0.jpeg`

        try {
            message.channel.send({files: [images]});
        } catch(err) {
            message.channel.send("YOU BROKE IT!!!");
        }
    },
}