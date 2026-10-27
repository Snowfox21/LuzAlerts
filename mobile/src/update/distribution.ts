import Constants from 'expo-constants';

/**
 * Canal de distribución de la build de Android, fijado al compilar
 * (DISTRIBUTION en eas.json -> app.config.js -> extra.distribution).
 *
 * - site: APK de luzalerts.lat. Se autoactualiza con dl/latest.json.
 * - play: Google Play. Su política prohíbe que la app se actualice por fuera
 *   de la tienda, así que esta variante no consulta latest.json, no instala
 *   APKs y no tiene el permiso REQUEST_INSTALL_PACKAGES.
 *
 * Todo lo que no sea "play" (desarrollo local, builds viejas) cuenta como
 * site: el comportamiento del APK del sitio no cambia.
 */
export type Distribution = 'play' | 'site';

export const DISTRIBUTION: Distribution =
    Constants.expoConfig?.extra?.distribution === 'play' ? 'play' : 'site';

export const SELF_UPDATE_ENABLED = DISTRIBUTION === 'site';
