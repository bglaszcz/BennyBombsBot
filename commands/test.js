const fetch = require('node-fetch');
const fs = require('fs');

module.exports = {
    name: 'test',
    description: 'test',
    async execute(message, args) {
        // var num = 0
        let keywords = "milk";
        if (args.length > 0) {
            keywords = args.join(" ");
        }
        let url = `https://g.tenor.com/v1/search?q=milk&key=VB2LPT9PUU0Z&limit=50`
        let response = await fetch(url);
        let json = await response.json();
        console.log(json.results.length);
        const index = Math.floor(Math.random() * json.results.length);

        message.channel.send(json.results[index].url);
    },
}