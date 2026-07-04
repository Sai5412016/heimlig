# Private Real Estate Agent

A modular Python agent that periodically searches for real estate
listings, filters them against your own criteria, and sends you a
Telegram (and optionally email) notification the moment something new
matches — for private, personal use only.

> Lives inside the `heimlig` monorepo on branch `claude/real-estate-agent-zibe4g`,
> in the `real-estate-agent/` folder. Its GitHub Actions workflow is at the
> repository root (`.github/workflows/real-estate-search.yml`) with
> `working-directory: real-estate-agent`, since GitHub only reads workflow
> files from the repo root.

## How it respects each site's terms of use

`immobilienscout24.de`, `immowelt.de` and `kleinanzeigen.de` do not offer
public APIs for individual/private use. Instead of reverse-engineering
undocumented endpoints or bypassing anti-bot measures, this agent:

- **never logs in, solves CAPTCHAs, spoofs a browser fingerprint, or
  rotates proxies** to get around a block — if a site blocks the request,
  the agent simply skips that source for the run and logs why;
- **checks `robots.txt` before every request** (see `search/base.py`) and
  refuses to fetch a URL its rules disallow;
- expects **you** to build the search yourself on the provider's website
  (with whatever filters you like there) and paste the resulting URL into
  `config.yaml` — the agent then just periodically re-fetches that one URL
  and parses the listings shown on it, rather than guessing query
  parameters;
- uses a low, transparent request rate (one run per 15 minutes, one page
  per source, with a short delay between sources) and an honest
  `User-Agent` that identifies it as this agent.

You are responsible for checking the current terms of service of any site
you point this agent at before enabling that source in `config.yaml`.

## Project structure

```
real-estate-agent/
  config.yaml              # all search criteria (no secrets)
  database.sqlite          # created on first run, gitignored
  requirements.txt
  README.md
  main.py                  # entry point / orchestrator

  search/
    base.py                # SearchProvider base class + robots.txt guard
    immobilienscout.py
    immowelt.py
    kleinanzeigen.py

  filter/
    filters.py              # price/area/rooms/plot/radius/keyword filters

  notify/
    telegram.py              # primary notification channel
    email.py                 # optional

  storage/
    database.py              # SQLite persistence + deduplication

  utils/
    distance.py               # haversine + Nominatim geocoding
    logger.py
    models.py                 # Property, SearchCriteria

  tests/
    test_filters.py
    test_models.py

.github/workflows/real-estate-search.yml   # at the repo root, see above
```

## Installation (local)

```bash
cd real-estate-agent
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

Run once:

```bash
python main.py
```

Run the tests:

```bash
python -m unittest discover -s tests
```

## Configuration

All search parameters live in `config.yaml` — nothing else needs editing
to change what you're looking for:

```yaml
search:
  type: [house, apartment]
  buy: true
  rent: false
  sources:
    immobilienscout:
      enabled: true
      search_url: "https://www.immobilienscout24.de/Suche/..."   # your own saved search
    immowelt:
      enabled: true
      search_url: ""
    kleinanzeigen:
      enabled: true
      search_url: ""

location:
  center: Augsburg
  radius: 25 # km

price:
  min: 0
  max: 650000

living_area:
  min: 130 # m²

rooms:
  min: 5

plot:
  min: 500 # m²

keywords: [garage, garten]     # at least one must appear in the title
exclude: [erbpacht]            # none of these may appear in the title

notify:
  telegram: { enabled: true }
  email: { enabled: false }
```

To get a `search_url`: go to the provider's website, set up the search you
want (location, price, etc. — the site's own filters, not this file's),
run it, and copy the resulting URL from your browser's address bar.

### Secrets (never put these in `config.yaml`)

| Variable             | Used by            | Required               |
| --------------------- | ------------------ | ----------------------- |
| `TELEGRAM_BOT_TOKEN`  | `notify/telegram.py` | if Telegram enabled     |
| `TELEGRAM_CHAT_ID`    | `notify/telegram.py` | if Telegram enabled     |
| `SMTP_HOST`           | `notify/email.py`   | if email enabled        |
| `SMTP_PORT`           | `notify/email.py`   | optional, default 587   |
| `SMTP_USER`           | `notify/email.py`   | if email enabled        |
| `SMTP_PASSWORD`       | `notify/email.py`   | if email enabled        |
| `EMAIL_TO`            | `notify/email.py`   | if email enabled        |

Locally, export them in your shell or use a `.env` file loaded by your
shell/tooling of choice (a plain `.env` is gitignored already).

## Setting up the Telegram bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram, send
   `/newbot`, and follow the prompts. You'll get a **bot token**.
2. Start a chat with your new bot (send it any message) so it's allowed to
   message you back.
3. Find your **chat ID**: message your bot, then open
   `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser and read
   `result[0].message.chat.id`.
4. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` as GitHub Actions
   secrets (repo → Settings → Secrets and variables → Actions) and/or in
   your local shell for manual runs.

## GitHub Actions

`.github/workflows/real-estate-search.yml` (at the repository root) runs
the agent every 15 minutes:

1. checks out the repo,
2. installs Python 3.12 and the dependencies from `requirements.txt`,
3. restores the previous run's `database.sqlite` from the Actions cache
   (so already-seen listings are still known — the cache key is
   run-scoped with a shared restore-key prefix, since GitHub Actions
   caches are immutable per key; stale entries expire automatically after
   7 days),
4. runs `python main.py`, forwarding the secrets above as environment
   variables,
5. uploads `agent.log` as a build artifact (kept 14 days) even if the run
   failed, and lets the step's exit code fail the job cleanly on error —
   a failure in the agent never leaves the workflow in an ambiguous state.

You can also trigger it manually via the "Run workflow" button
(`workflow_dispatch`).

## Adding a new search source

1. Create `search/<name>.py` with a class subclassing
   `search.base.SearchProvider`. Implement `search() -> list[Property]`,
   using `self._get(url)` for any HTTP request (it enforces the
   `robots.txt` check for you).
2. Register it in `search/__init__.py`'s `PROVIDERS` dict.
3. Add a `search.sources.<name>` block to `config.yaml`.

No other file needs to change — `main.py`, `filter/filters.py`,
`storage/database.py` and the notifiers all operate on the shared
`Property` model, not on any provider specifics.

## Extending the agent

The architecture was built so these can be added without restructuring
existing modules:

- **Map view / web UI / mobile app** — read directly from
  `storage/database.py`; it's a plain SQLite file.
- **Price analysis / price per m²** — `Property.price_per_sqm` already
  exists on the model (`utils/models.py`); a new `filter/` or `reports/`
  module can aggregate over `PropertyDatabase`.
- **Commute time calculation** — add a sibling function to
  `utils/distance.py` (e.g. using a routing API) alongside the existing
  haversine/geocoding helpers.
- **Favorites** — add a `favorite` column/table in
  `storage/database.py`.
- **AI summaries / image recognition** — new modules under, e.g.,
  `enrich/`, called from `main.py` between `apply_filters` and
  `notify_new_property`, operating on the same `Property` objects.
- **Multiple search profiles** — turn `config.yaml` into a list of
  profiles (or multiple config files) and loop `main.py`'s cycle once per
  profile, each with its own `PropertyDatabase` path.

## Known limitations

- The CSS selectors in `search/immobilienscout.py`, `search/immowelt.py`
  and `search/kleinanzeigen.py` reflect each site's public results-page
  markup at the time of writing. Listing sites change their HTML
  periodically; if a source starts returning 0 results despite visible
  listings in a browser, inspect the page and update the selectors (each
  file documents where).
- Geocoding uses the free OpenStreetMap Nominatim API and is rate-limited
  to one request/second per their usage policy; distance filtering fails
  open (keeps the listing) if geocoding is temporarily unavailable, so a
  match is never silently dropped due to a geocoding hiccup.
