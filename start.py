import os
import sys
import subprocess
import shutil

print("🌎 Welcome to Movie Globe Setup & Runner! 🎬")
print("===========================================")
print("Let's set up your personalized 3D movie map.")
print("You will need:")
print("1. Your Douban User ID")
print("2. Your Douban Cookie (From F12 Network tab)")
print("3. A TMDB API Key")
print("")

scraper_dir = os.path.join(os.path.dirname(__file__), 'scraper')
env_file = os.path.join(scraper_dir, '.env')

# Prompt user for credentials if .env doesn't exist
if not os.path.exists(env_file):
    print("✨ Creating your configuration file...")
    douban_id = input("Enter your Douban User ID (e.g., 12345678): ").strip()
    douban_cookie = input("Paste your Douban Cookie string here: ").strip()
    tmdb_key = input("Enter your TMDB API Key: ").strip()
    proxy = input("Enter proxy address if needed (e.g., http://127.0.0.1:7897) or press Enter to skip: ").strip()

    with open(env_file, 'w', encoding='utf-8') as f:
        f.write(f"DOUBAN_USER_ID={douban_id}\n")
        f.write(f"DOUBAN_COOKIE=\"{douban_cookie}\"\n")
        f.write(f"TMDB_API_KEY={tmdb_key}\n")
        if proxy:
            f.write(f"HTTP_PROXY={proxy}\n")
            f.write(f"HTTPS_PROXY={proxy}\n")
    print("\n✅ Configuration saved securely to scraper/.env!\n")
else:
    print("✅ Configuration already exists in scraper/.env. Skipping setup.\n")

# Install dependencies if needed
print("📦 Checking Python dependencies...")
try:
    import dotenv
    import tqdm
    import requests
    import bs4
except ImportError:
    print("Installing required Python packages...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", os.path.join(scraper_dir, "requirements.txt")])
    print("✅ Dependencies installed!\n")

# Run the scraping pipeline
print("🚀 Starting the high-speed data scraping pipeline...")
print("Please wait while we fetch your movies from Douban, TMDB, and IMDb...")
try:
    # Run the main.py scraper script
    subprocess.check_call([sys.executable, "main.py"], cwd=scraper_dir)
except subprocess.CalledProcessError as e:
    print("\n❌ Scraping failed! Please check your network or proxy settings.")
    sys.exit(1)

# Copy the result to the frontend
print("\n✨ Data processing complete! Copying files to the frontend...")
frontend_dir = os.path.join(os.path.dirname(__file__), 'frontend')
public_dir = os.path.join(frontend_dir, 'public')

if not os.path.exists(public_dir):
    os.makedirs(public_dir)

source_file = os.path.join(scraper_dir, 'movies.json')
dest_file = os.path.join(public_dir, 'movies.json')

if os.path.exists(source_file):
    shutil.copy2(source_file, dest_file)
    print("✅ Successfully updated the 3D Globe with your latest movie data!")
else:
    print("❌ movies.json was not generated properly.")
    sys.exit(1)

print("\n🎉 DONE! Your Movie Globe data is ready.")
print("===========================================")
print("To view your 3D globe right now:")
print("1. cd frontend")
print("2. npm install")
print("3. npm run dev")
print("===========================================")
