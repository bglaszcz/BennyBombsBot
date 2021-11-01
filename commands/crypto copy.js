const fetch = require('node-fetch');
const request = require('request')

module.exports = {
	name: `crypto`,
	description: 'Show crypto price.',
	async execute(message, args) {
		message.delete();
		let cryptoCurrency = args[0];
		if (args) {
			try{
			cryptoCurrency = args[0].toUpperCase();
			}
			catch (err) {}
			let symbol = args[1] ? args[1].toUpperCase() : 'USD';
			request(`https://min-api.cryptocompare.com/data/price?fsym=${cryptoCurrency}&tsyms=${symbol}&api_key=287b7aefca1f552bab735e9d5b6388bc10c6689aad4c114798b6681f98eafebc`, function(err, response, body) {
				if (err) {
					message.channel.send(err);
					return
				}
				try {
					let data = JSON.parse(body)
					if (!data[symbol]) {
						message.reply('Please select a correct currency (BTC, DOGE, ETH, ...) or symbol (USD, EUR, ...)').then(m => {
							setTimeout(() => {
								m.delete()
							}, 5000)
						})
					} else {
						if (parseFloat(data[symbol]) > 1) {
							var formatted = "$" + data[symbol].toFixed(2).replace(/\d(?=(\d{3})+\.)/g, "$&,");
							message.channel.send(`${cryptoCurrency}: ${formatted}`);
						} else {
							message.channel.send(`${cryptoCurrency}: $${data[symbol]}`);
						}
					}
				} catch (err) {
					message.channel.send('```' + err + '```Please select a correct currency (BTC, DOGE, ETH, ...) or symbol (USD, EUR, ...) or report this error on github with a screenshot https://github.com/LucasCtrl/CryptoBot/issues/new')
				}
			})
		}
	},
}