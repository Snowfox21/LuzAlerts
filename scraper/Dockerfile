FROM python:3.12-slim

WORKDIR /project

# Copy backend code (scraper imports models from it)
COPY backend/ /project/backend/

# Copy scraper code and install its deps
COPY scraper/requirements.txt /project/scraper/requirements.txt
RUN pip install --no-cache-dir -r /project/scraper/requirements.txt

COPY scraper/ /project/scraper/

WORKDIR /project/scraper

CMD ["python", "main.py"]
