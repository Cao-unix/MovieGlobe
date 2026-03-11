import json
import os
import sys
from collections import Counter
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
SCRAPER_DIR = PROJECT_ROOT / "scraper"
REPORT_VERSION = 3

load_dotenv(SCRAPER_DIR / ".env", override=False)

if str(SCRAPER_DIR) not in sys.path:
    sys.path.insert(0, str(SCRAPER_DIR))

from fetch_douban import fetch_douban_movies  # noqa: E402
from fetch_tmdb import fetch_tmdb_data  # noqa: E402
from geocode import geocode_locations  # noqa: E402
from main import generate_frontend_data  # noqa: E402


@contextmanager
def temporary_cwd(path):
    previous = Path.cwd()
    os.chdir(path)
    try:
        yield
    finally:
        os.chdir(previous)


def compute_average(values):
    filtered = [value for value in values if isinstance(value, (int, float))]
    if not filtered:
        return None
    return round(sum(filtered) / len(filtered), 2)


def build_report(douban_id, coords_file, movies_file):
    with open(coords_file, "r", encoding="utf-8") as f:
        detailed_movies = json.load(f)

    with open(movies_file, "r", encoding="utf-8") as f:
        globe_movies = json.load(f)

    country_counts = Counter()
    location_counts = Counter()
    for movie in detailed_movies:
        for country in movie.get("countries", []):
            country_counts[country] += 1
    for movie in globe_movies:
        location = movie.get("location_name")
        if location:
            location_counts[location] += 1

    report_title = f"Movie Globe for {douban_id}"
    report = {
        "report_version": REPORT_VERSION,
        "douban_id": douban_id,
        "title": report_title,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "movie_count": len(detailed_movies),
        "point_count": len(globe_movies),
        "avg_douban": compute_average([movie.get("douban_rating") for movie in detailed_movies]),
        "avg_imdb": compute_average([movie.get("imdb_rating") for movie in detailed_movies]),
        "top_countries": [
            {"name": name, "count": count} for name, count in country_counts.most_common(8)
        ],
        "top_locations": [
            {"name": name, "count": count} for name, count in location_counts.most_common(8)
        ],
        "movies": globe_movies,
    }
    return report


def run_pipeline(douban_id, work_dir, progress_callback=None):
    progress_callback = progress_callback or (lambda percent, message: None)

    work_dir = Path(work_dir)
    work_dir.mkdir(parents=True, exist_ok=True)

    douban_file = work_dir / "douban_movies.json"
    locations_file = work_dir / "movies_with_locations.json"
    coords_file = work_dir / "movies_with_coords.json"
    frontend_file = work_dir / "movies.json"

    progress_callback(5, "Fetching Douban watch history and ratings.")
    movies = fetch_douban_movies(
        douban_id,
        test_mode=False,
        fetch_details=True,
        use_cookie=True,
        page_sleep_seconds=0,
        detail_workers=12,
    )
    with open(douban_file, "w", encoding="utf-8") as f:
        json.dump(movies, f, ensure_ascii=False, indent=2)

    progress_callback(35, "Matching movies with TMDB and filming locations.")
    fetch_tmdb_data(
        str(douban_file),
        str(locations_file),
        max_workers=8,
        include_imdb_locations=True,
    )

    progress_callback(70, "Geocoding filming locations to map coordinates.")
    with temporary_cwd(SCRAPER_DIR):
        geocode_locations(str(locations_file), str(coords_file), request_delay=0)

    progress_callback(90, "Building the shareable globe report.")
    generate_frontend_data(str(coords_file), str(frontend_file))

    report = build_report(douban_id, coords_file, frontend_file)
    progress_callback(100, "Report is ready.")
    return report
