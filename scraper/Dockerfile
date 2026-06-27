# Playwright base image ships Chromium + all system libraries needed to run it
# headless (required to pass the Radware JS challenge on ande.gov.py).
# Keep the version in sync with the `playwright` pin in requirements.txt.
FROM mcr.microsoft.com/playwright/python:v1.49.1-noble

# Xvfb provides a virtual X display so Chromium can run *headed* on this headless
# server — Radware detects headless Chromium and blocks it with a CAPTCHA, so a
# real (virtual) display is required to pass the bot challenge.
RUN apt-get update && apt-get install -y --no-install-recommends xvfb \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /project

# Copy backend code (scraper imports models from it)
COPY backend/ /project/backend/

# Copy scraper code and install its deps
COPY scraper/requirements.txt /project/scraper/requirements.txt
RUN pip install --no-cache-dir -r /project/scraper/requirements.txt

# Chromium is preinstalled in the base image, but ensure the matching build is present
RUN python -m playwright install chromium

COPY scraper/ /project/scraper/

WORKDIR /project/scraper

# Run under a virtual display so Chromium can launch headed (see note above).
CMD ["xvfb-run", "-a", "--server-args=-screen 0 1366x768x24", "python", "main.py"]
