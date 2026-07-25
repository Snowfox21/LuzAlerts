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

# Install the full (headed-capable) Chromium that patchright's patched driver
# expects. patchright replaces the playwright package, so we use its CLI here.
# ande_parser._chromium_path() then locates the `chrome` binary under
# /ms-playwright (skipping the headless-shell build).
RUN python -m patchright install chromium

COPY scraper/ /project/scraper/

WORKDIR /project/scraper

# Liveness: the scraper touches /tmp/scraper_heartbeat at the end of every run
# (poll interval is 4h). If it goes stale (>5h) the process has silently died or
# hung — the container is marked unhealthy and the autoheal sidecar restarts it
# (see docker-compose.yml). start-period covers the first, challenge-heavy run.
HEALTHCHECK --interval=5m --timeout=10s --start-period=8m --retries=2 \
    CMD test -f /tmp/scraper_heartbeat \
        && [ $(( $(date +%s) - $(cat /tmp/scraper_heartbeat) )) -lt 18000 ] \
        || exit 1

# Run under a virtual display so Chromium can launch headed (see note above).
CMD ["xvfb-run", "-a", "--server-args=-screen 0 1366x768x24", "python", "main.py"]
