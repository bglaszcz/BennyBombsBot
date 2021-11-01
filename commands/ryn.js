module.exports = {
    name: `ryn`,
    description: 'Ryn being a little bitch',
    execute(message, args) {
            // message.channel.send(`Fuq yeah they do. CLAP CLAP CLAP`);
            message.delete();
            let url = `https://c.tenor.com/A-NINAUpA2gAAAAC/the-office-michael-scott.gif`
            message.channel.send(url)
        },
}
