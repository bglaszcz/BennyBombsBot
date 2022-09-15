const CoinMarketCap = require('coinmarketcap-api');
const { SlashCommandBuilder } = require('discord.js');
// const { TextChannel } = require('discord.js');

const apiKey = '8d6744fb-e444-4696-bd53-790ffec9745f';
const client = new CoinMarketCap(apiKey);

const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
});

module.exports = {
    data: new SlashCommandBuilder()
        .setName(`crypto`)
        .setDescription('Show crypto price.'),
	async execute(message, args) {
		message.delete();
		const cryptoCurrency = args[0];

        const ticker = await client.getQuotes({ symbol: cryptoCurrency });

        if (!ticker.data) {
            message.reply(ticker.status.error_message).then(m => {
                setTimeout(() => {
                    m.delete();
                }, 5000);
            });
        }
        else {
            for (const prop in ticker.data) {
                const name = ticker.data[prop].name;
                const symbol = ticker.data[prop].symbol;
                const price = ticker.data[prop].quote.USD.price;
                const change24 = ticker.data[prop].quote.USD.percent_change_24h.toFixed(2);
                const volumechange24 = ticker.data[prop].quote.USD.volume_change_24h.toFixed(2);

                    if (price < 1) {
                        message.channel.send(`${name} (${symbol}): $${price.toFixed(9)} (${change24}%) (Vol 24H:${volumechange24}%)`);
                    }
                    else {
                        message.channel.send(`${name} (${symbol}): ${formatter.format(price)} (${change24}%) (Vol 24H:${volumechange24}%)`);
                    }
            }
        }
	},
};