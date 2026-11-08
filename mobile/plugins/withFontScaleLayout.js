const { withMainApplication } = require('expo/config-plugins');

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

module.exports = config =>
    withMainApplication(config, mod => {
        mod.modResults.contents = addFontScaleOverride(mod.modResults.contents);
        return mod;
    });
