const fetch = require('node-fetch');

var request = require(`request`);
var cheerio = require(`cheerio`);
const { first } = require('cheerio/lib/api/traversing');
const Discord = require("discord.js");

module.exports = {
    name: `test`,
    description: 'Show stock price.',
    async execute(message, args) {
        let URL = `https://finance.yahoo.com/quote/${args}`;
        message.delete();
        request(URL, function(err, resp, body) {
            if (err)
                throw err;

            var $ = cheerio.load(body);

            //console.log($(`[data-test='TD_VOLUME-value']`).first().text().toString());

            var company = $(`h1[data-reactid='7']`).first().text().toString();
            var cur_price = $(`#quote-market-notice`).parent().children('span').first().text();
            var change = $(`#quote-market-notice`).parent().children('span').eq(1).first().text();
            var volume = $(`[data-test='TD_VOLUME-value']`).first().text().toString();
            var volume_avg = $(`[data-test='AVERAGE_VOLUME_3MONTH-value']`).first().text().toString();

            
            let exampleEmbed = new Discord.MessageEmbed()
            .setColor('#0099ff')
            .setURL(URL)
            .setTitle(company)
            .addFields(
                {name: 'Price', value: cur_price, inline: true},
                {name: 'Change', value: change, inline: true},
                { name: '\u200B', value: '\u200B', inline: true},
                {name: '24 Hour Volume', value: volume, inline: true},
                {name: 'Average Volume', value: volume_avg, inline: true}
            );    

            message.channel.send(exampleEmbed);

            // if (company) {
            //     message.channel.send(`${company}: ${cur_price} ${change} (vol:${volume})`);
            // } else {
            // message.channel.send(`No stonk with the ticker ${args}.`)
            // }
            
        })

        },
}
