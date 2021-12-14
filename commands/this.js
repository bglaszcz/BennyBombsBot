module.exports = {
    name: `this`,
    description: `^^^^^^^^^^^^^`,
    execute(message, args) {
            
            // message.delete();
            let url = `https://media.giphy.com/media/oxLpLI0eNf3Wg/giphy.gif`
            message.channel.send(url)
        },
}
