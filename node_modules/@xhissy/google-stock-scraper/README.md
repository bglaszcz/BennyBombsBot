# Original Author
https://www.npmjs.com/package/stock-market-scraper

# Google Stock Market Scraper
A node package that allows you to scrape ticker info from Google Finance

# Installation

```shell
npm install @xhissy/google-stock-scraper
```

# Usage
### Using .then()
```js
const scrape = require('@xhissy/google-stock-scraper');

// Replace GOOGL with any Ticker
scrape('GOOGL', [afterMarket]) // After market price is a boolean. Default: true
.then(info => console.log(info));

// Result:
// {
//  companyName: 'Alphabet Inc Class A',
//  ticker: { 
//    exchange: 'NASDAQ', 
//    code: 'GOOGL'
//  },
//  price: '2,051.00',
//  stats: {
//    open: '2,076.41',
//    high: '2,077.61',
//    low: '2,032.42',
//    cap: '1.39T',
//    ratio: '32.77',
//    yield: '-',
//    previousClose: '2,100.54',
//    yearhigh: '2,145.14',
//    yearlow: '1,008.87'
//  },
//  daily: { 
//    value: '−50.54', 
//    percentage_format: '2.41%', 
//    direction: 'down' 
//  }
// }

```
### Using async/await

```js
const scrape = require('@xhissy/google-stock-scraper');

// Replace GOOGL with any Ticker
(async() => {
    const get = await scrape('GOOGL', [afterMarket]); // After market price is a boolean. Default: true
    console.log(get);
})();

// Result:
// {
//  companyName: 'Alphabet Inc Class A',
//  ticker: { 
//    exchange: 'NASDAQ', 
//    code: 'GOOGL'
//  },
//  price: '2,051.00',
//  stats: {
//    open: '2,076.41',
//    high: '2,077.61',
//    low: '2,032.42',
//    cap: '1.39T',
//    ratio: '32.77',
//    yield: '-',
//    previousClose: '2,100.54',
//    yearhigh: '2,145.14',
//    yearlow: '1,008.87'
//  },
//  daily: { 
//    value: '−50.54', 
//    percentage_format: '2.41%', 
//    direction: 'down' 
//  }
// }
