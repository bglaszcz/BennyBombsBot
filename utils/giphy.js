const { GIPHYApiKey } = require('../config.json');

/**
 * Pick a random GIF for a search term.
 * @param {string} query
 * @param {{ limit?: number }} [options]
 * @returns {Promise<{ url: string, imageUrl: string } | null>} null when nothing matched
 */
async function randomGif(query, { limit = 50 } = {}) {
    const params = new URLSearchParams({ api_key: GIPHYApiKey, q: query, limit: String(limit), rating: 'r' });
    const response = await fetch(`https://api.giphy.com/v1/gifs/search?${params}`);
    if (!response.ok) throw new Error(`Giphy request failed: ${response.status}`);

    const json = await response.json();
    if (!json.data?.length) return null;

    const gif = json.data[Math.floor(Math.random() * json.data.length)];
    return { url: gif.url, imageUrl: gif.images.original.url };
}

module.exports = { randomGif };
