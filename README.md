# BennyBombsBot

A Discord bot built with discord.js v14 for server games, memes, AI chat, Wordle tracking, stock lookups, and more.

## Features

- **Games** - Good Morning Crypto (GMC) daily game, Lucas excuses with XP betting, slot machine, Boot Jaf tracking
- **AI Integration** - Google Gemini-powered chat responses, AI image generation, conversation summaries
- **Wordle & MapTap Tracking** - Automatic score detection, stats, leaderboards, head-to-heads, and weekly champions
- **Social** - Goutcord Awards (nominations + poll voting), out-of-context quotes, starboard, XP/leveling, yearly Wrapped
- **Finance** - Stock quotes via Yahoo Finance
- **Fun** - Meme/inside-joke commands, GIF lookups, image responses
- **Utility** - Message pruning, date countdowns, server/user info
- **User Memory** - The bot remembers things about users across conversations
- **Scheduled Posts** - Morning Gazette recap, 9pm Wordle reminders, Sunday weekly champions

## Commands

| Category | Command | Description |
|----------|---------|-------------|
| **Games** | `/gmc` | Good Morning Crypto game |
| | `/gmcstats` | GMC stats and leaderboard |
| | `/gac` | Generate a Lucas excuse (settles bets) |
| | `/gacbet` | Bet XP on what Lucas's excuse will be about |
| | `/slot` | Slot machine game |
| | `/bootjaf` | Count the times we boot jaf |
| | `/bootjafboard` | Boot Jaf leaderboard |
| | `/jafchart` | Jaf fun chart |
| **Wordle** | `/wordlestats` | View your Wordle statistics |
| | `/wordleleaderboard` | Server Wordle leaderboard |
| | `/wordlevs` | Head-to-head Wordle record |
| | `/wordlereminder` | Opt in/out of the 9pm reminder |
| | `/wordlesync` | Import historical Wordle scores (Admin) |
| **MapTap** | `/maptapstats` | View your MapTap statistics |
| | `/maptapleaderboard` | Server MapTap leaderboard |
| | `/maptapvs` | Head-to-head MapTap record |
| | `/maptapsync` | Import historical MapTap scores (Admin) |
| **Social** | `/nominate` | Nominate messages for awards; `polls`/`results` run the voting |
| | `/wrapped` | Your Goutcord year in review |
| | *Right-click → Apps* | **Add to Out of Context**, **Nominate for Award** |
| | `/outofcontext` | Save/retrieve out-of-context quotes |
| | `/leaderboard` | Top 15 users by XP and level |
| | `/levelup-message` | View level-up trigger messages |
| **Finance** | `/stonk` | Stock/crypto price lookup |
| | `/doesrynbill` | Does Ryn bill? |
| **Utility** | `/tldr` | Snarky summary of recent conversation |
| | `/image` | Generate an image from a prompt |
| | `/gif` | Random GIF picker |
| | `/memory` | View what the bot remembers about a user |
| | `/gazette` | Preview the Morning Gazette (Manage Server) |
| | `/days` | Days until a future date |
| | `/fridaythen` | It's Friday Then |
| | `/prune` | Prune up to 99 messages |
| | `/ping` | Pong! |
| | `/help` | Show help menu |
| | `/server` | Server info |
| | `/user` | User info |
| **Fun** | `/roast` | Get roasted (opt-in via banter) |
| | `/dethtoots` | Deth toot leaderboard |
| | `/dallas` | Well that's Dallas |
| | `/supeson` | Random son gif |
| | `/kim` | You know what it is |
| | `/mel` | Mella Yellin |
| | `/weapprove` | Your supes approve |
| | `/vaccination` | What is it good for? |
| | `/ryn` | Ryn gif |
| | `/peg` | Peg? |
| | `/this` | ^^^^^^^^^^ |
| | `/idk` | I don't know what that means |

## Tech Stack

- **Runtime:** Node.js
- **Framework:** discord.js v14
- **Database:** PostgreSQL via Sequelize ORM
- **AI:** Google Gemini via `@google/genai`
- **APIs:** Yahoo Finance, GIPHY

## Project Structure

```
BennyBombsBot/
├── bot.js                  # Entry point - loads commands, events, models
├── deploy-commands.js      # Slash command deployment CLI
├── db.js                   # Sequelize database connection
├── commands/
│   ├── fun/                # Meme/joke one-liner commands
│   ├── games/              # GMC, slot, bootjaf, GAC
│   ├── wordle/             # Wordle stats, leaderboard, sync
│   ├── social/             # Nominations, out-of-context, leaderboard
│   ├── utility/            # Info, moderation, AI tools
│   └── finance/            # Stock and crypto lookups
├── events/                 # Discord event handlers (XP, Wordle tracking, AI chat)
├── models/                 # Sequelize models; require('./models') for the shared registry
├── services/               # Business logic: Gemini client, user memory, scheduler, gazette, awards
├── utils/                  # Shared helpers: periods, Wordle/MapTap parsing, Giphy, nicknames
├── scripts/                # One-off maintenance scripts (db-sync)
├── assets/
│   └── images/             # Static image assets
└── config/                 # settings.js (channel/role IDs, schedules) + Google credentials
```

## Setup

### Prerequisites

- Node.js v18+ (uses built-in fetch)
- PostgreSQL database
- A [Discord bot token](https://discord.com/developers/applications)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/bglaszcz/BennyBombsBot.git
   cd BennyBombsBot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure the bot:**

   Create a `config.json` in the project root:
   ```json
   {
     "token": "YOUR_DISCORD_BOT_TOKEN",
     "clientId": "YOUR_BOT_CLIENT_ID",
     "guildId": "YOUR_TEST_SERVER_ID",
     "geminiApiKey": "YOUR_GEMINI_API_KEY",
     "geminiModel": "gemini-model-name",
     "geminiImageModel": "gemini-image-model-name",
     "botId": "YOUR_BOT_USER_ID",
     "GIPHYApiKey": "YOUR_GIPHY_API_KEY"
   }
   ```

   Channel/role IDs, schedule hours and tunables live in `config/settings.js`.
   Optional features (Morning Gazette, starboard, champion roles) stay off until
   their IDs are filled in there.

4. **Deploy slash commands:**
   ```bash
   # Deploy to a test server (instant)
   npm run deploy

   # Deploy globally (takes up to 1 hour to propagate)
   npm run deploy:global
   ```

5. **Start the bot:**
   ```bash
   npm start
   ```

### Other Scripts

```bash
npm run deploy:delete   # Remove all deployed commands
npm run db:sync         # Apply model column changes to the database (sync with alter)
npm run lint            # ESLint
```

## License

ISC
