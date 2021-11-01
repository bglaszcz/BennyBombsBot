module.exports = {
    name: 'vaccination',
    description: 'Vaccination? What is it good for?',
    execute(message, args) {
        message.channel.send('= Depopulation!').then(function(sentMessage) {sentMessage.react(`<:this_tbh:870658997605253120>`)}
        );
    },
}