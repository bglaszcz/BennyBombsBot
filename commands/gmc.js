const fetch = require('node-fetch');
const fs = require('fs');
var emojis = [`:cross:`, `:raised_hands:`, `:pray:`, `:heart:`, `:purple_heart:`, `:orange_heart:`, `:green_heart:`, `:yellow_heart:`, `:blue_heart:`, `:white_heart:`, `:sparkling_heart:`, `:cupid:`
, `<:copeland:783500238550990898>`, `<:rynshades:779055142829686874>`
, `<:ryn:779061066616930344>`, `<:voight:779101232404889671>`, `<:oldjaf:779053402993983549>`, `<:oldcarson:779061569589346344>`, `<:covidcarson:821464324114481222>`
, `<:carsonpov:789227168039174175>`, `<:jaf:779083932900524063>`, `<:jaf_kiss:844965438928322600>`
, `<:Lucas:779074815118016542>`, `<:travmugshot:822464895710134303>`, `<:ban:779096052874608661>`
, `<:candyman:789539023529312307>`, `<:happydad:789530835694387200>`, `<:don:779081980825698334>`, `<:nanc:779075468850233344>`, `<:sonnanc:779069433779978240>`
, `<:dal:905143312061698058>`, `<:dal2:905143807501303918>`];

module.exports = {
    name: 'gmc',
    description: 'GOOD MORNING CREW',
    async execute(message, args) {   
        
        let gmc = fs.readFileSync(`./bootjaf/gmc.txt`, {"encoding":"utf-8"});
        let today = new Date().toLocaleString('en-us', {weekday: 'long'});

        if (gmc == today) {
            message.channel.send("The crew has been wished good morning already.");
        } else {
        var writing = fs.writeFileSync(`./bootjaf/gmc.txt`, `${today}`);
        const spot1 = Math.floor(Math.random() * emojis.length);
        const spot2 = Math.floor(Math.random() * emojis.length);
        const spot3 = Math.floor(Math.random() * emojis.length);
        const spot4 = Math.floor(Math.random() * emojis.length);
        const spot5 = Math.floor(Math.random() * emojis.length);

        message.channel.send(emojis[spot1] + emojis[spot2] + emojis[spot3] + emojis[spot4] + emojis[spot5] + `:regional_indicator_g:` + `:regional_indicator_m:` + `:regional_indicator_c:` +
        emojis[spot5] + emojis[spot4] + emojis[spot3] + emojis[spot2] + emojis[spot1] );
        }      
       
    },
}