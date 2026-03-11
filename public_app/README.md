# Movie Globe Public App

This is a deployable public-facing app built on top of the existing `MovieGlobe` scraper.

## What it does

- Accepts a Douban ID or profile URL
- Queues a background job on the server
- Scrapes the user's public movie history
- Matches movies to TMDB and IMDb filming locations
- Geocodes the locations to coordinates
- Saves the finished report in SQLite
- Serves a public shareable report page for phone and desktop

## Stack

- FastAPI
- Jinja templates + vanilla JavaScript
- SQLite for saved reports and job state
- Existing Python scraper pipeline from `../scraper`

## Run locally

From the `MovieGlobe/public_app` directory:

```bash
pip install -r requirements.txt
uvicorn app:app --reload
```

Then open `http://127.0.0.1:8000`.

Or simply:

```bash
python start.py
```

## Notes

- The scraper still depends on the existing `scraper/.env` values when needed.
- Reports are saved to `public_app/data/movieglobe.db`.
- Raw job outputs are stored under `public_app/data/jobs/<douban_id>/`.
- The worker is serial by default, which is safer for the current scraper and geocoding flow.
