# LuzParaguay Backend — Quick Start

## Требования
- Python 3.10+
- Docker (для PostgreSQL + PostGIS)

## Запуск

### 1. База данных (Docker)
```bash
docker-compose up -d
```

### 2. Виртуальное окружение и зависимости
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Переменные окружения
```bash
cp .env.example .env
# Отредактируйте .env при необходимости
```

### 4. Запуск API
```bash
cd backend
uvicorn app.main:app --reload
```

API доступен по адресу: http://localhost:8000

Документация (Swagger): http://localhost:8000/docs

## Эндпоинты

| Метод  | URL                          | Описание                              |
|--------|------------------------------|---------------------------------------|
| GET    | /                            | Health check                          |
| POST   | /users/                      | Регистрация / обновление устройства   |
| GET    | /outages/                    | Список отключений (с фильтрами)       |
| POST   | /reports/                    | Новая геометка "нет света"            |
| GET    | /reports/                    | Метки в радиусе                       |
| POST   | /subscriptions/              | Подписка на район / фидер             |
| GET    | /subscriptions/              | Список подписок                       |
| DELETE | /subscriptions/{id}          | Удалить подписку                      |

## Архитектура геолокации

Координаты хранятся в PostGIS (SRID 4326).  
При создании метки бэкенд автоматически определяет barrio, улицу и город через **OSM Nominatim reverse geocoding**.  
Пространственные запросы (поиск меток / отключений в радиусе) выполняются через `ST_DWithin` на geography-типе.
