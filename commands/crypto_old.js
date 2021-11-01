const fetch = require('node-fetch');
const request = require('request')

module.exports = {
	name: `crypto_old`,
	description: 'Show crypto price.',
	async execute(message, args) {
		message.delete();
		let cryptoCurrency = args[0];
		if (args) {
			try{
			cryptoCurrency = args[0].toUpperCase();
			}
			catch (err) {console.log(`we here`)}
			let symbol = args[1] ? args[1].toUpperCase() : 'USD';
            request(`https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${cryptoCurrency}&tsyms=${symbol}&api_key=287b7aefca1f552bab735e9d5b6388bc10c6689aad4c114798b6681f98eafebc`, function(err, response, body) {
				if (err) {
					message.channel.send(err);
					return
				}
				try {
                    
					let data = JSON.parse(body);
                    let price = data.DISPLAY[cryptoCurrency].USD.PRICE;
                    let change = data.DISPLAY[cryptoCurrency].USD.CHANGEPCT24HOUR 

					if (!price) {
						message.reply('Please select a correct currency (BTC, DOGE, ETH, ...) or symbol (USD, EUR, ...)').then(m => {
							setTimeout(() => {
								m.delete()
							}, 5000)
						})
					} else {
							message.channel.send(`${cryptoCurrency}: ${price} (${change}%)`);
						}
                    }
                catch (err)	{console.log(err);}
            })
		}
	},
}