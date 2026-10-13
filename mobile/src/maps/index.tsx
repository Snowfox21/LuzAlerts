// Нативная карта (Android/iOS-натив): просто реэкспорт react-native-maps.
// На вебе (PWA) Metro вместо этого файла берет index.web.tsx: react-native-maps
// веб не поддерживает и валит сборку `expo export -p web` на импорте.
//
// Расширение .tsx здесь обязательно, не .ts: Metro перебирает расширения
// по порядку (ts, потом tsx) и внутри каждого сначала платформенный файл.
// При index.ts он нашел бы его раньше, чем дошел до index.web.tsx, и веб
// снова потянул бы react-native-maps.
export * from 'react-native-maps';
export { default } from 'react-native-maps';
