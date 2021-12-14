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

            if (date_ob <= 8 && minutes < 30) {
                var priceHeader = "Price (Pre-Market)"
                var changeHeader = "Change (Pre-Market)"
                var embedColor = "#FFAE42"
                var cur_price = $(`fin-streamer[data-field='preMarketPrice']`).text();
                var change = $(`fin-streamer[data-field='preMarketChange']`).text();
            } else if (date_ob > 14 ) {
                var priceHeader = "Price (After Hours)"
                var changeHeader = "Change (After Hours)"
                var embedColor = "#FF5349"
                var cur_price = $(`fin-streamer[class="C($primaryColor) Fz(24px) Fw(b)"]`).text();
                var change = $(`fin-streamer[class="Mstart(4px) D(ib) Fz(24px)"]`).text();
            } else {
                var priceHeader = "Price"
                var changeHeader = "Change"
                var embedColor = '#0000FF'
                var cur_price = $('fin-streamer[class="Fw(b) Fz(36px) Mb(-4px) D(ib)"]').attr("value");
                var change = $(`fin-streamer[class="Fw(500) Pstart(8px) Fz(24px)"]`).text();
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
