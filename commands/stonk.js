const yahooFinance = require(`yahoo-finance2`).default;
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
        .setName(`stonk`)
        .setDescription(`Stonk information`)
        .addStringOption(option => option
                                    .setName('ticker')
                                    .setDescription('Enter the ticker name')
                                    .setRequired(true)),
    async execute(interaction) {

        const date_ob = new Date().getHours();
        const minutes = new Date().getMinutes();

        const ticker = interaction.options.getString('ticker');
        const tickerUrl = `https://finance.yahoo.com/quote/${ticker}`;

        const result = await yahooFinance.quoteSummary(ticker);
        const company = result.price.shortName;

        const volume = result.price.regularMarketVolume.toLocaleString("en-US");
        const volume_avg = result.summaryDetail.averageVolume.toLocaleString("en-US");

        if (date_ob <= 8 && minutes < 30 && company) {
            const exampleEmbed = new EmbedBuilder()
                .setColor("#FFAE42")
                .setURL(tickerUrl)
                .setTitle(company)
                .addFields(
                    { name: "Price (Pre-Market)", value: result.price.preMarketPrice.toLocaleString('en-US', { style: 'currency', currency: 'USD' }), inline: true },
                    { name: "Change (Pre-Market)", value: (result.price.preMarketChangePercent * 100).toFixed(2) + "%", inline: true },
                    { name: '\u200B', value: '\u200B', inline: true },
                    { name: '24 Hour Volume', value: volume, inline: true },
                    { name: 'Average Volume', value: volume_avg, inline: true },
                );
            interaction.reply({ embeds: [exampleEmbed] });
        }
        else if (date_ob > 14 && company) {
            const exampleEmbed = new EmbedBuilder()
                .setColor("#FF5349")
                .setURL(tickerUrl)
                .setTitle(company)
                .addFields(
                    { name: "Price (After Hours)", value: result.price.postMarketPrice.toLocaleString('en-US', { style: 'currency', currency: 'USD' }), inline: true },
                    { name: "Change (After Hours)", value: (result.price.postMarketChangePercent * 100).toFixed(2) + "%", inline: true },
                    { name: '\u200B', value: '\u200B', inline: true },
                    { name: '24 Hour Volume', value: volume, inline: true },
                    { name: 'Average Volume', value: volume_avg, inline: true },
                );
                interaction.reply({ embeds: [exampleEmbed] });
        }
        else if (company) {
            const exampleEmbed = new EmbedBuilder()
                .setColor('#0000FF')
                .setURL(tickerUrl)
                .setTitle(company)
                .addFields(
                    { name: "Price", value: result.price.regularMarketPrice.toLocaleString('en-US', { style: 'currency', currency: 'USD' }), inline: true },
                    { name: "Change", value: (result.price.regularMarketChangePercent * 100).toFixed(2) + "%", inline: true },
                    { name: '\u200B', value: '\u200B', inline: true },
                    { name: '24 Hour Volume', value: volume, inline: true },
                    { name: 'Average Volume', value: volume_avg, inline: true },
                );
                interaction.reply({ embeds: [exampleEmbed] });
        }
        else {
            interaction.reply(`No stonk with the ticker ${ticker}.`);
            }
    },
};