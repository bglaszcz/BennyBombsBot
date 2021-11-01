module.exports = {
    name: `dokimscheeksclap`,
    description: 'Do Kims Cheeks Clap?',
    execute(message, args) {
            message.channel.send(`Fuq yeah they do. CLAP CLAP CLAP`);
            
            let url = `https://media.giphy.com/media/rhq4biotLkkRG/giphy.gif`
            message.channel.send(url)
        },
}
