const fetch = require('node-fetch');
// const TENORKEY = process.env.TENORKEY;


module.exports = {
name: 'gif',
description: 'We Show Gifs!',
async execute (message, args) {
    let keywords = 'boot';
    if (args.length > 0) {
    keywords = args.join(' ');
    }

    let testing = encodeURI(keywords);
    let url = `https://g.tenor.com/v1/search?q=${testing}&key=VB2LPT9PUU0Z&limit=7`
    // console.log(message.channel.id);
    if (message.channel.id === `942167244232851497`) 
    {
      url = `https://g.tenor.com/v1/search?q=${testing}%20boobs&key=VB2LPT9PUU0Z&limit=7`;      
      // console.log(url);
    }
    else {
      url = `https://g.tenor.com/v1/search?q=${testing}&key=VB2LPT9PUU0Z&limit=7`;
    }
    // let url = `https://g.tenor.com/v1/search?q=${testing}&key=VB2LPT9PUU0Z&limit=7`;
    // else 
    // let url = `https://g.tenor.com/v1/search?q=${testing}&key=${TENORKEY}&limit=7`;
    
    let response = await fetch(url);

    let json = await response.json();

    const index = Math.floor(Math.random() * json.results.length);

    try {
      message.channel.send(json.results[index].url);
    } catch(err) {
      message.channel.send(`Yo, a gif for ${keywords} wasn't found.`);
    }
  }, 
};