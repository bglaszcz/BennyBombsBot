const fs = require('fs');
const imageFiles = fs.readdirSync('./images/FridayThen');

module.exports = {
    name: 'fridaythen',
    description: `It's Friday Thennnnn`,
    execute(message, args) {
        let today = new Date().toLocaleString('en-us', {weekday: 'long'});

        var images = new Array();

        images[0] = `./images/FridayThen/Monday-FridayThen.png`;
        images[1] = `./images/FridayThen/Tuesday-FridayThen.png`;
        images[2] = `./images/FridayThen/Wednesday-FridayThen.png`;
        images[3] = `./images/FridayThen/Thursday-FridayThen.png`;

        if (today == "Monday") {
            message.channel.send(`Dafuq? It's *${today}*, not Friday fam`);
            message.channel.send({files: [images[0]]});
        } else if (today == "Tuesday") {
            message.channel.send(`Dafuq? It's *${today}*, not Friday fam`);
            message.channel.send({files: [images[1]]});  
        }
        else if (today == "Wednesday") {
            message.channel.send(`Dafuq? It's *${today}*, not Friday fam`);
            message.channel.send({files: [images[2]]});  
        }
        else if (today == "Thursday") {
            message.channel.send(`Dafuq? It's *${today}*, not Friday fam`);
            message.channel.send({files: [images[3]]});  
        }
        else if (today == "Friday") {
            message.channel.send(`https://www.youtube.com/watch?v=1AnG04qnLqI%27`);
        }
        else if (today == "Saturday") {
            var randoVid = Math.floor(Math.random()*3);
            if (randoVid == 0) {
                message.channel.send(`https://www.youtube.com/watch?v=COhGLcZW-X4`);
            } else if (randoVid == 1) {
                message.channel.send(`https://www.youtube.com/watch?v=PeKTzfmLPiI`);
            }
            else if (randoVid == 2) {
                message.channel.send(`https://www.youtube.com/watch?v=BVc8Ja0iqRE`);
            }
        }
        else if (today == "Sunday") {
            message.channel.send(`The Sunday scaries are upon us.`);
            message.channel.send(`https://www.youtube.com/watch?v=oDJcGMfyg6E&t=19s`);
        }


    },
}