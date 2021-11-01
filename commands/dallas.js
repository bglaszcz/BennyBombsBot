module.exports = {
    name: `dallas`,
    description: `Well that's Dallas`,
    execute(message, args) {
            // message.channel.send(`Fuq yeah they do. CLAP CLAP CLAP`);
            message.delete();
            let url = `https://c.tenor.com/882g69bLwI0AAAAC/the-office-andy-bernard.gif`
            message.channel.send(url)
        },
}
