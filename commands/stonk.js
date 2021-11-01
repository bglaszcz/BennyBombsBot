const fetch = require('node-fetch');

var request = require(`request`);
var cheerio = require(`cheerio`);
const { first } = require('cheerio/lib/api/traversing');

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
            var company = $(`h1[data-reactid='7']`).first().text().toString();
            var cur_price = $(`#quote-market-notice`).parent().children('span').first().text();
            var change = $(`#quote-market-notice`).parent().children('span').eq(1).first().text();
            if (company) {
                message.channel.send(company + `: ` + cur_price + ` ` + change);
            } else {
            message.channel.send(`No stonk with the ticker ${args}.`)
            }
            
        })

        },
}
