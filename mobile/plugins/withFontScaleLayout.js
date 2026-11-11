const { withAndroidManifest, withMainActivity, withMainApplication } = require('expo/config-plugins');

// Android recrea la Activity cuando cambia el tamaño de letra del sistema, pero
// el proceso y el runtime de React Native siguen vivos. La caché C++ de medidas
// de texto no incluye la escala en su clave mientras este flag esté apagado
// (getFontScale devuelve 1), así que el texto se dibuja con la letra nueva dentro
// de cajas medidas con la vieja: "Programa", "LuzAler", "Sin", "Ma...".
// Con el flag, la escala entra en la clave y el texto se vuelve a medir.
//
// Va después de loadReactNative porque ese método ya hace override de los flags;
// por eso dangerouslyForceOverride. La delegación conserva los demás valores.
const IMPORTS = [
    'import com.facebook.react.internal.featureflags.ReactNativeFeatureFlags',
    'import com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsOverrides_RNOSS_Stable_Android',
    'import com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsProvider',
];

const OVERRIDE = `    ReactNativeFeatureFlags.dangerouslyForceOverride(
      object : ReactNativeFeatureFlagsProvider by ReactNativeFeatureFlagsOverrides_RNOSS_Stable_Android(true, true, true) {
        override fun enableFontScaleChangesUpdatingLayout(): Boolean = true
      }
    )`;

const LOAD_CALL = /^(\s*)loadReactNative\(this\)\s*$/m;

function addFontScaleOverride(source) {
    if (source.includes('enableFontScaleChangesUpdatingLayout')) return source;
    // Si la plantilla de Expo cambia, mejor que falle la build a publicar un APK sin el arreglo.
    if (!LOAD_CALL.test(source)) {
        throw new Error('withFontScaleLayout: no se encontró loadReactNative(this) en MainApplication.kt');
    }
    return source
        .replace(LOAD_CALL, match => `${match}\n${OVERRIDE}`)
        .replace(/^import com\.facebook\.react\.ReactApplication$/m, line => `${line}\n${IMPORTS.join('\n')}`);
}

// Con el flag solo no alcanza. En 1.2.8 los testers con Android 11 y 15 seguían
// viendo el texto cortado en lo que ya estaba montado antes del cambio (Mapa,
// Lista, las pestañas), mientras que Ajustes, que se abre después, salía bien.
// En el emulador pasa lo mismo cuando la superficie de React sobrevive al cambio:
// la parte nativa mide de nuevo, pero React guarda sus propios nodos ya medidos
// y en el render siguiente vuelven las medidas viejas.
//
// Lo único que deja todo como en un arranque en frío es reiniciar la instancia de
// React. Por eso la Activity declara que maneja fontScale (Android no la recrea y
// no hay dos arranques seguidos) y, cuando detecta que la escala cambió, relee las
// métricas de pantalla y recarga React. Cambiar la letra del sistema es raro: la
// app vuelve a su pantalla inicial, igual que si se hubiera abierto de nuevo.
const HANDLED_CONFIG_CHANGES = ['fontScale'];

function addConfigChanges(manifest) {
    const activities = manifest.manifest.application?.[0]?.activity ?? [];
    const main = activities.find(activity => activity.$['android:name'] === '.MainActivity');
    if (!main) {
        throw new Error('withFontScaleLayout: no se encontró .MainActivity en AndroidManifest.xml');
    }
    const current = (main.$['android:configChanges'] ?? '').split('|').filter(Boolean);
    const missing = HANDLED_CONFIG_CHANGES.filter(change => !current.includes(change));
    main.$['android:configChanges'] = [...current, ...missing].join('|');
    return manifest;
}

const ACTIVITY_IMPORTS = [
    'import android.content.Context',
    'import android.content.res.Configuration',
    'import com.facebook.react.uimanager.DisplayMetricsHolder',
];

// lastFontScale vive en el proceso, no en la Activity. Hay dos casos:
// - Activity nueva (attachBaseContext): arranque en frío, o Android la recreó
//   porque junto con la letra cambió algo que no manejamos (el tamaño de
//   pantalla). React arma una superficie nueva y mide todo de cero: alcanza con
//   releer las métricas. Recargar ahí choca con el desmontaje de la Activity
//   vieja (NullPointerException en RNGestureHandlerRootHelper.tearDown).
// - Activity viva (onResume / onConfigurationChanged): hay que recargar React.
const ACTIVITY_METHODS = `
  override fun attachBaseContext(newBase: Context) {
    super.attachBaseContext(newBase)
    val fontScale = newBase.resources.configuration.fontScale
    if (lastFontScale != 0f && lastFontScale != fontScale) {
      DisplayMetricsHolder.initDisplayMetrics(applicationContext)
    }
    lastFontScale = fontScale
  }

  override fun onResume() {
    super.onResume()
    reloadIfFontScaleChanged()
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    reloadIfFontScaleChanged()
  }

  private fun reloadIfFontScaleChanged() {
    val fontScale = resources.configuration.fontScale
    if (lastFontScale == fontScale) return
    lastFontScale = fontScale
    DisplayMetricsHolder.initDisplayMetrics(applicationContext)
    reactHost?.reload("cambió el tamaño de letra del sistema")
  }

  companion object {
    // Escala de letra con la que React midió la interfaz por última vez (0 = todavía no).
    private var lastFontScale = 0f
  }
`;

const ACTIVITY_CLASS = /^class MainActivity : ReactActivity\(\) \{$/m;

function addReloadOnFontScale(source) {
    if (source.includes('reloadIfFontScaleChanged')) return source;
    if (!ACTIVITY_CLASS.test(source)) {
        throw new Error('withFontScaleLayout: no se encontró la clase MainActivity en MainActivity.kt');
    }
    const lastBrace = source.lastIndexOf('}');
    const withMethods = `${source.slice(0, lastBrace).trimEnd()}\n${ACTIVITY_METHODS}}\n`;
    return withMethods.replace(/^(package [^\n]+\n)/, `$1${ACTIVITY_IMPORTS.join('\n')}\n`);
}

module.exports = config => {
    config = withMainApplication(config, mod => {
        mod.modResults.contents = addFontScaleOverride(mod.modResults.contents);
        return mod;
    });
    config = withMainActivity(config, mod => {
        mod.modResults.contents = addReloadOnFontScale(mod.modResults.contents);
        return mod;
    });
    return withAndroidManifest(config, mod => {
        mod.modResults = addConfigChanges(mod.modResults);
        return mod;
    });
};
