#!/usr/bin/env bash
# Выпуск APK вне Google Play.
#
# Стора, который догонял бы пользователей обновлением, у сайдлоада нет:
# приложение само опрашивает web/dl/latest.json и сравнивает versionCode.
# Поэтому релиз — это два согласованных действия: выложить APK и обновить
# манифест. Разъехались — обновление либо не приедет, либо приедет в никуда.
#
# Порядок важен: APK кладется первым. Если сначала обновить манифест,
# между двумя шагами приложения увидят новую версию и упрутся в 404.
set -euo pipefail

VPS="${VPS:-root@62.238.25.158}"
REMOTE_WEB="${REMOTE_WEB:-/opt/luzalerts/web}"
MOBILE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../mobile" && pwd)"

usage() {
    cat <<USAGE
Использование: $0 <путь-к-apk> [--mandatory] [--notes "текст по-испански"]

  <путь-к-apk>   локальный файл, скачанный из EAS:
                 cd mobile && eas build --profile preview --platform android
                 (ссылку на артефакт eas печатает в конце сборки)

  --mandatory    обновление нельзя отложить кнопкой "Después".
                 Только для сломанных версий.
  --notes        что нового. Показывается пользователю как есть,
                 поэтому по-испански и в voseo.
USAGE
    exit 1
}

[ $# -ge 1 ] || usage
APK="$1"; shift
[ -f "$APK" ] || { echo "Нет такого файла: $APK" >&2; exit 1; }

MANDATORY=false
NOTES=""
while [ $# -gt 0 ]; do
    case "$1" in
        --mandatory) MANDATORY=true; shift ;;
        --notes) NOTES="${2:-}"; shift 2 ;;
        *) usage ;;
    esac
done

# Версию берем из app.config.js, а не из аргументов: руками разъезжается.
VERSION_NAME=$(node -e "console.log(require('$MOBILE_DIR/app.config.js').expo.version)")
VERSION_CODE=$(node -e "console.log(require('$MOBILE_DIR/app.config.js').expo.android.versionCode)")

# sha256 приложение сверяет перед установкой: 100 МБ по мобильной сети
# доезжают битыми чаще, чем хочется, а установщик на битом APK говорит
# только невнятное "Ошибка синтаксического анализа пакета".
SHA256=$(shasum -a 256 "$APK" | awk '{print $1}')
SIZE=$(wc -c < "$APK" | tr -d ' ')

echo "Версия:      $VERSION_NAME (versionCode $VERSION_CODE)"
echo "Файл:        $APK"
echo "Размер:      $((SIZE / 1024 / 1024)) МБ"
echo "sha256:      $SHA256"
echo "Обязательно: $MANDATORY"
echo

INSTALLED_CODE=$(curl -fsS https://luzalerts.lat/dl/latest.json 2>/dev/null | node -e \
    "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).versionCode)}catch{console.log(0)}})" || echo 0)
if [ "$VERSION_CODE" -le "${INSTALLED_CODE:-0}" ]; then
    echo "versionCode $VERSION_CODE не больше опубликованного $INSTALLED_CODE." >&2
    echo "Подними versionCode в mobile/app.config.js и пересобери." >&2
    exit 1
fi

# 1. APK. Заливаем во временное имя и переставляем атомарно: иначе тот,
# кто качает прямо сейчас, получит обрезанный файл.
echo "→ Заливаю APK…"
scp "$APK" "$VPS:$REMOTE_WEB/luzalerts.apk.new"
ssh "$VPS" "mv $REMOTE_WEB/luzalerts.apk.new $REMOTE_WEB/luzalerts.apk"

# 2. Манифест — только после того, как APK на месте.
echo "→ Обновляю манифест…"
NOTES_JSON=$(NOTES="$NOTES" node -e 'console.log(JSON.stringify(process.env.NOTES))')
ssh "$VPS" "mkdir -p $REMOTE_WEB/dl && cat > $REMOTE_WEB/dl/latest.json" <<JSON
{
  "versionCode": $VERSION_CODE,
  "versionName": "$VERSION_NAME",
  "apkUrl": "https://luzalerts.lat/luzalerts.apk",
  "sha256": "$SHA256",
  "sizeBytes": $SIZE,
  "mandatory": $MANDATORY,
  "notes_es": $NOTES_JSON
}
JSON

echo "→ Проверяю…"
curl -fsS https://luzalerts.lat/dl/latest.json
echo
REMOTE_SHA=$(ssh "$VPS" "sha256sum $REMOTE_WEB/luzalerts.apk | awk '{print \$1}'")
[ "$REMOTE_SHA" = "$SHA256" ] && echo "✓ APK на сервере совпадает с локальным" \
    || { echo "✗ sha256 на сервере разошелся: $REMOTE_SHA" >&2; exit 1; }
