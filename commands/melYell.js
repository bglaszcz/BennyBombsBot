const fetch = require('node-fetch');

module.exports = {
    name: 'melyell',
    description: 'Does Mel Yell?',
    async execute(message, args) {     
        let keywords = "yell";
        if (args.length > 0) {
            keywords = args.join(" ");
        }
        let url = `https://api.tenor.com/v1/search?q=yell&key=VB2LPT9PUU0Z`;
        let response = await fetch(url);
        let json = await response.json();

        const index = Math.floor(Math.random() * json.results.length);

        message.channel.send(json.results[index].url);
    },
}