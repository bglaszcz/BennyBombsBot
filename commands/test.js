let options = {weekday: `long`, year:`numeric`, month:`long`, day:`numeric`};

module.exports = {
    name: 'test',
    description: 'test!',
    execute(message, args) {

        try{
            var endDate = new Date(args);
        }
        catch (error) {
            console.error(error);
        }

        const diffTime = Math.abs(Date.now() - endDate);
        const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));
        // let today = new Date().toLocaleString('en-us', {weekday: 'long'});
        const dateFormat = new Date(endDate).toLocaleString('en-us', options);

        message.channel.send(`${diffDays} days until ${dateFormat}`);
    },
}