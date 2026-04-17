# workana-server

Monitors Workana job listings and posts new projects to a Telegram channel. Runs in a continuous loop with configurable intervals, filters, and human-like browser behavior to avoid bot detection.

## Features

- Scrapes new job postings from Workana with category and language filters
- Filters by budget threshold and recency
- Posts formatted notifications to Telegram (bot or user account mode)
- Session persistence via cookie file — no repeated logins
- Anti-detection: stealth plugin, browser fingerprinting, human-like delays, proxy support
- Auto-restarts browser on page death or scrape errors

## Requirements

- Node.js 18+
- Google Chrome installed at `/usr/bin/google-chrome-stable` (or set `CHROME_PATH`)
- A Telegram bot token or user account API credentials

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your credentials and settings
```

## Configuration

Copy `.env.example` to `.env` and fill in the values:

```env
# === Telegram ===
TELEGRAM_MODE=bot                  # bot: Bot API | account: MTProto user account
TELEGRAM_CHANNEL_ID=               # @channel_name or -100xxxxxxxxxx
TELEGRAM_BOT_TOKEN=                # From @BotFather (bot mode only)

# Account mode only (TELEGRAM_MODE=account):
# TELEGRAM_API_ID=
# TELEGRAM_API_HASH=
# TELEGRAM_PHONE=

# === Monitoring ===
MONITOR_INTERVAL_MIN=3             # Min wait between cycles (minutes)
MONITOR_INTERVAL_MAX=6             # Max wait between cycles (minutes)
MONITOR_NIGHT_PAUSE=false          # Pause during night hours
MONITOR_NIGHT_START=0              # Night pause start hour (0–23)
MONITOR_NIGHT_END=7                # Night pause end hour (0–23)

# === Search Filters ===
SEARCH_CATEGORY=it-programming     # Workana category ID
SEARCH_LANGUAGE=xx                 # xx=All, en=English, es=Español, pt=Português

# === Browser ===
BROWSER_HEADLESS=false             # true: headless | false: visible window
PROXY_URL=                         # Optional SOCKS5 proxy: socks5://user:pass@host:port

# === Posting Filters ===
TIMEZONE=UTC                       # Timezone for message timestamps
MAX_BUDGET=0                       # Minimum upper budget to post (0 = no filter)
MAX_PAGES_PER_CYCLE=5              # Max listing pages to scan per cycle

# === Storage ===
CACHE_TTL_HOURS=48                 # Hours to remember seen projects
```

### Telegram Bot Mode

1. Create a bot with [@BotFather](https://t.me/BotFather) and get the token
2. Add the bot to your channel as an admin with post permission
3. Set `TELEGRAM_MODE=bot` and `TELEGRAM_BOT_TOKEN=<token>`

To find your channel ID, run `npm run info-bot`, send `/info` in the target channel, and use the returned ID.

### Telegram Account Mode

1. Get API credentials at [my.telegram.org/apps](https://my.telegram.org/apps)
2. Set `TELEGRAM_MODE=account`, `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, and `TELEGRAM_PHONE`
3. On first run, you will be prompted for the OTP sent to your phone

## Usage

```bash
# Start continuous monitoring (runs forever)
npm start

# Run a single cycle and exit (useful for testing)
npm run once

# Open Workana in a visible browser with proxy + fingerprint applied (for manual inspection)
npm run workana

# Find the ID of a Telegram channel (send /info in the channel)
npm run info-bot
```

## First Run

On the first cycle, the server:
1. Launches the browser and checks login status
2. If not logged in and headless is `false`: waits for you to log in manually
3. If not logged in and headless is `true`: reopens the browser in visible mode for manual login, then relaunches headless
4. Navigates to the job listing and applies category/language filters
5. Caches all currently visible projects (does not post them)

From the second cycle onward, only newly appeared projects are posted.

## Session & Data Files

| Path | Description |
|------|-------------|
| `data/cookie.json` | Browser cookies loaded at startup to restore login session |
| `data/fingerprint.json` | Persistent browser fingerprint (UA, screen, timezone, WebGL) |
| `data/cache.json` | Seen project URLs with timestamps |
| `data/telegram-session` | MTProto session file (account mode only) |
| `logs/combined.log` | All log output |
| `logs/error.log` | Errors only |

To restore a login session, place the exported cookies into `data/cookie.json` in the following format:

```json
{
  "url": "https://www.workana.com/dashboard",
  "cookies": [
    {
      "name": "...",
      "value": "...",
      "domain": ".www.workana.com",
      "path": "/",
      "secure": true,
      "httpOnly": true,
      "sameSite": "lax",
      "expirationDate": 1800000000
    }
  ]
}
```

## Proxy Support

Set `PROXY_URL` to a SOCKS5 proxy URL. The timezone in the browser fingerprint is automatically adjusted to match the proxy's detected IP location.

```env
PROXY_URL=socks5://user:pass@host:1080
```
