const fs = require('fs');
const dayjs = require('dayjs');

module.exports = {
	name: 'messageCreate',
	execute(message) {
        if (message.content.toLowerCase().includes('deth toots')
                                    // Bot ID
            && message.author.id != '806354375151845406'
                                    // Dals ID
            && message.author.id == '266356395094441986'
        ) {

		const tootDate = fs.readFileSync('./bootjaf/deth.txt', { 'encoding':'utf-8' });
        const now = dayjs();

        const between = now - tootDate;
        const myDate = new Date(Number(tootDate));

        const seconds = (between / 1000).toFixed(1);
        const minutes = (between / (1000 * 60)).toFixed(1);
        const hours = (between / (1000 * 60 * 60)).toFixed(1);
        const days = (between / (1000 * 60 * 60 * 24)).toFixed(1);
        if (seconds < 60) {
            message.channel.send(`${message.author} last had deth toots on ${myDate.toLocaleString()}. ${seconds} seconds since ${message.author} last deth toots`);
        }
        else if (minutes < 60) {
            message.channel.send(`${message.author} last had deth toots on ${myDate.toLocaleString()}. ${minutes} minutes since ${message.author} last deth toots`);
        }
        else if (hours < 24) {
            message.channel.send(`${message.author} last had deth toots on ${myDate.toLocaleString()}. ${hours} hours since ${message.author} last deth toots`);
        }
        else {
            message.channel.send(`${message.author} last had deth toots on ${myDate.toLocaleString()}. ${days} days since ${message.author} last deth toots`);
        }

		fs.writeFileSync(`./bootjaf/deth.txt`, `${Date.now()}`);
		return;
	}
	},
};