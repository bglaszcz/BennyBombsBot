module.exports = {
    name: 'doesrynbill',
    description: 'doesrynbill!',
    execute(message, args) {

        var rando = Math.floor(Math.random() * 100) + 1;
        var today = new Date(Date.now());

        if (rando == 69) {
            message.channel.send(`LET IT BE KNOWN! On the Lords day of ${today.toLocaleDateString()} ryn did a bill.`)
        }
        else {
            message.channel.send(`I looked into it, he does not.`);
        }
    },
}