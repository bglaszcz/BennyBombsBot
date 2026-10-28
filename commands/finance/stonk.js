const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const usd = value => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const percent = value => `${(value * 100).toFixed(2)}%`;
const count = value => (value ?? 0).toLocaleString('en-US');

/**
 * Pick the most relevant price for the current trading session.
 * Yahoo reports marketState as PRE / PREPRE / REGULAR / POST / POSTPOST / CLOSED.
 */
function getSessionQuote(price) {
    const state = price.marketState;

    if ((state === 'PRE' || state === 'PREPRE') && price.preMarketPrice != null) {
        return { label: 'Pre-Market', color: '#FFAE42', value: price.preMarketPrice, change: price.preMarketChangePercent };
    }
    if ((state === 'POST' || state === 'POSTPOST') && price.postMarketPrice != null) {
        return { label: 'After Hours', color: '#FF5349', value: price.postMarketPrice, change: price.postMarketChangePercent };
    }
    return {
        label: state === 'REGULAR' ? null : 'Market Closed',
        color: '#0000FF',
        value: price.regularMarketPrice,
        change: price.regularMarketChangePercent,
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stonk')
        .setDescription('Stonk information')
        .addStringOption(option => option
            .setName('ticker')
            .setDescription('Enter the ticker name')
            .setRequired(true)),
    async execute(interaction) {
        const ticker = interaction.options.getString('ticker').trim().toUpperCase();

        await interaction.deferReply();

        let result;
        try {
            result = await yahooFinance.quoteSummary(ticker);
        }
        catch (error) {
            console.error(`Stonk lookup failed for ${ticker}:`, error.message);
            return interaction.editReply(`No stonk with the ticker ${ticker}. 📉`);
        }

        const { price, summaryDetail } = result;
        if (!price?.shortName || price.regularMarketPrice == null) {
            return interaction.editReply(`No stonk with the ticker ${ticker}. 📉`);
        }

        const quote = getSessionQuote(price);
        const suffix = quote.label ? ` (${quote.label})` : '';

        const embed = new EmbedBuilder()
            .setColor(quote.color)
            .setURL(`https://finance.yahoo.com/quote/${encodeURIComponent(ticker)}`)
            .setTitle(`${price.shortName} (${ticker})`)
            .addFields(
                { name: `Price${suffix}`, value: usd(quote.value), inline: true },
                { name: `Change${suffix}`, value: quote.change != null ? percent(quote.change) : 'N/A', inline: true },
                { name: '​', value: '​', inline: true },
                { name: '24 Hour Volume', value: count(price.regularMarketVolume), inline: true },
                { name: 'Average Volume', value: count(summaryDetail?.averageVolume), inline: true },
            );

        return interaction.editReply({ embeds: [embed] });
    },
};
