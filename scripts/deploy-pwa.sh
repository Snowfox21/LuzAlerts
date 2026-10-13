#!/usr/bin/env bash
# Сборка и выкладка PWA для iOS (luzalerts.lat/app).
#
# Это тот же код mobile/, собранный web-таргетом Expo. Android/EAS сборку
# не трогает. Caddy раздает каталог /opt/luzalerts/app-web как
# /srv/app-web (см. docker-compose.caddy.yml и handle_path /app/* в
# Caddyfile), так что после rsync перезапуск контейнеров не нужен.
#
# Разовые шаги перед первым запуском (вне скрипта):
#   1. DNS: A-запись app.luzalerts.lat -> IP VPS (старый адрес, Caddy
#      редиректит его на luzalerts.lat/app).
#   2. VAPID_* ключи в /opt/luzalerts/.env на VPS, миграция 0007,
#      пересборка backend и scraper (в них появился pywebpush).
#   3. Перезапуск caddy, чтобы подхватить новый Caddyfile и volume.
set -euo pipefail

# Адрес сервера живет в scripts/.deploy.env (в git не попадает, см. .gitignore),
# либо передается переменной: VPS=user@host ./scripts/deploy-pwa.sh
[ -f "$(dirname "${BASH_SOURCE[0]}")/.deploy.env" ] && . "$(dirname "${BASH_SOURCE[0]}")/.deploy.env"
VPS="${VPS:?Укажите сервер: VPS=user@host ./scripts/deploy-pwa.sh (или задайте в scripts/.deploy.env)}"
REMOTE_APP_WEB="${REMOTE_APP_WEB:-/opt/luzalerts/app-web}"
MOBILE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../mobile" && pwd)"
OUT_DIR="$MOBILE_DIR/dist"

cd "$MOBILE_DIR"
rm -rf "$OUT_DIR"
# Продакшн-сборка: apiClient ходит на https://luzalerts.lat (не __DEV__).
npx expo export -p web --output-dir "$OUT_DIR"

# Самопроверка: без этих файлов PWA не установится и не получит пуши.
for f in index.html manifest.json sw.js apple-touch-icon.png icons/icon-192.png icons/icon-512.png icons/icon-maskable-512.png; do
    [ -f "$OUT_DIR/$f" ] || { echo "В сборке нет $f" >&2; exit 1; }
done
# Без experiments.baseUrl бандл ссылается на /_expo, а под /app его нет.
grep -q '/app/_expo/static/' "$OUT_DIR/index.html" || { echo "index.html собран без baseUrl /app" >&2; exit 1; }

ssh "$VPS" "mkdir -p '$REMOTE_APP_WEB'"
# --delete: старые бандлы с хэшем в имени больше не нужны. index.html
# кладется последним, чтобы он не ссылался на еще не залитый бандл.
rsync -az --delete --exclude index.html "$OUT_DIR/" "$VPS:$REMOTE_APP_WEB/"
rsync -az "$OUT_DIR/index.html" "$VPS:$REMOTE_APP_WEB/index.html"

echo "Готово: https://luzalerts.lat/app/"
