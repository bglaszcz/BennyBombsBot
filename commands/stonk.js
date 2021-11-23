const fetch = require('node-fetch');

var request = require(`request`);
var cheerio = require(`cheerio`);
const { first } = require('cheerio/lib/api/traversing');
const Discord = require("discord.js");

module.exports = {
    name: `stonk`,
    description: 'Show stock price.',
    async execute(message, args) {
        let URL = `https://finance.yahoo.com/quote/${args}`;
        message.delete();
        request(URL, function(err, resp, body) {
            if (err)
                throw err;

            var $ = cheerio.load(body);

            let date_ob = new Date().getHours();
            let minutes = new Date().getMinutes();

            var company = $(`h1[data-reactid='7']`).first().text().toString();
            var volume = $(`[data-test='TD_VOLUME-value']`).first().text().toString();
            var volume_avg = $(`[data-test='AVERAGE_VOLUME_3MONTH-value']`).first().text().toString();

            // if (date_ob < 16) {
            //     var cur_price = $(`#quote-market-notice`).parent().children('span').first().text();
            //     var change = $(`#quote-market-notice`).parent().children('span').eq(1).first().text();
            // } else {
            //     var cur_price = $(`span[data-reactid='52']`).first().text().toString();
            //     var change = $(`span[data-reactid='55']`).first().text().toString();
            // }

            if (date_ob <= 8 && minutes < 30) {
                var priceHeader = "Price (Pre-Market)"
                var changeHeader = "Change (Pre-Market)"
                var embedColor = "#fa7b62"
                var cur_price = $(`span[data-reactid='52']`).first().text().toString();
                var change = $(`span[data-reactid='55']`).first().text().toString();
            } else if (date_ob > 14 ) {
                var priceHeader = "Price (After Hours)"
                var changeHeader = "Change (After Hours)"
                var embedColor = "#ECC1B2"
                var cur_price = $(`span[data-reactid='52']`).first().text().toString();
                var change = $(`span[data-reactid='55']`).first().text().toString();
            } else {
                var priceHeader = "Price"
                var changeHeader = "Change"
                var embedColor = '#0099ff'
                var cur_price = $(`#quote-market-notice`).parent().children('span').first().text();
                var change = $(`#quote-market-notice`).parent().children('span').eq(1).first().text();
            }

            if (company) {
                let exampleEmbed = new Discord.MessageEmbed()
                .setColor(embedColor)
                .setURL(URL)
                .setTitle(company)
                .addFields(
                    {name: priceHeader, value: cur_price, inline: true},
                    {name: changeHeader, value: change, inline: true},
                    {name: '\u200B', value: '\u200B', inline: true},
                    {name: '24 Hour Volume', value: volume, inline: true},
                    {name: 'Average Volume', value: volume_avg, inline: true},
                );    
                message.channel.send(exampleEmbed);
            }
            else {
            message.channel.send(`No stonk with the ticker ${args}.`)
            }
            
        })

        },
}
