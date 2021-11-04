const CoinMarketCap = require('coinmarketcap-api');
const { TextChannel } = require('discord.js');

const apiKey = '8d6744fb-e444-4696-bd53-790ffec9745f'
const client = new CoinMarketCap(apiKey)

var formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
})

module.exports = {
	name: `crypto`,
	description: 'Show crypto price.',
	async execute(message, args) {
		message.delete();
		let cryptoCurrency = args[0];
        
        const ticker = await client.getQuotes({symbol: cryptoCurrency});     
        
        if (!ticker.data) {
            message.reply(ticker.status.error_message).then(m => {
                setTimeout(() => {
                    m.delete()
                }, 5000)
            })
        } else {
            for (const prop in ticker.data) {
                //console.log(ticker.data[prop].quote);
                var name = ticker.data[prop].name;
                var symbol = ticker.data[prop].symbol
                var price = ticker.data[prop].quote.USD.price;
                var change24 = ticker.data[prop].quote.USD.percent_change_24h.toFixed(2);
                var volumechange24 = ticker.data[prop].quote.USD.volume_change_24h.toFixed(2);

                    if (price < 1) {
                        message.channel.send(`${name} (${symbol}): $${price.toFixed(9)} (${change24}%) (Vol 24H:${volumechange24}%)`);
                    }
                    else {
                        message.channel.send(`${name} (${symbol}): ${formatter.format(price)} (${change24}%) (Vol 24H:${volumechange24}%)`);
                    }
            }
        }
	},
}