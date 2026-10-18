# Clash Stats

A small website for looking up Clash of Clans players and clans by tag, using the official [Clash of Clans API](https://developer.clashofclans.com).

- **Players:** town hall, trophies, war stars, donations, plus levels for heroes, equipment, pets, troops, siege machines, spells and the builder base.
- **Clans:** level, war record, description and the full member list. Click a member to open their profile.

## Setup

You need Python 3.9 or newer. There's nothing else to install.

1. Create an API key at https://developer.clashofclans.com. The key only works from the IP addresses you add to it, so add your computer's public IP.
2. Copy `.env.example` to `.env` and paste in your key:
   ```
   COC_API_KEY=your-api-key-here
   ```
3. Start the server:
   ```
   python3 server.py
   ```
4. Open http://localhost:8000

If searches fail with a certificate error, your Python can't verify HTTPS. This is common with Python from python.org on macOS. Fix it with:

```
python3 -m pip install certifi
```

## How it works

The browser can't call the Clash of Clans API directly: the API doesn't allow it, and the key would be exposed. Instead, `server.py` serves the site and forwards `/api/player/<tag>` and `/api/clan/<tag>` to the API, adding the key on the server side. The key never reaches the browser.

`.env` is in `.gitignore`. Never commit your key.
