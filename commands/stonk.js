var request = require(`request`);
const yahooFinance = require(`yahoo-finance2`).default;
const Discord = require("discord.js");


module.exports = {
    name: `stonk`,
    description: 'Show stock price.',
    async execute(message, args) {

        let date_ob = new Date().getHours();
        let minutes = new Date().getMinutes();
        
        const result = await yahooFinance.quoteSummary(`${args}`);
        const company = result.price.shortName;
        //const cur_price = result.price.regularMarketPrice.toLocaleString('en-US', {style: 'currency', currency: 'USD'});
        //const change = (result.price.regularMarketChangePercent * 100).toFixed(2)+"%";
        const volume = result.price.regularMarketVolume.toLocaleString("en-US");
        const volume_avg = result.summaryDetail.averageVolume.toLocaleString("en-US");

        if (date_ob <= 8 && minutes < 30) {t
            var priceHeader = "Price (Pre-Market)"
            var changeHeader = "Change (Pre-Market)"
            var cur_price = result.price.preMarketPrice.toLocaleString('en-US', {style: 'currency', currency: 'USD'});
            var change = (result.price.preMarketChangePercent * 100).toFixed(2)+"%";
            var embedColor = "#FFAE42"
        } else if (date_ob > 14 ) {
            var priceHeader = "Price (After Hours)"
            var changeHeader = "Change (After Hours)"
            var cur_price = result.price.postMarketPrice.toLocaleString('en-US', {style: 'currency', currency: 'USD'});
            var change = (result.price.postMarketChangePercent * 100).toFixed(2)+"%";
            var embedColor = "#FF5349"
        } else {
            var priceHeader = "Price"
            var changeHeader = "Change"
            var cur_price = result.price.regularMarketPrice.toLocaleString('en-US', {style: 'currency', currency: 'USD'});
            var change = (result.price.regularMarketChangePercent * 100).toFixed(2)+"%";
            var embedColor = '#0000FF'
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
    }
}
