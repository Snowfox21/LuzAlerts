// Canal de distribución de Android: "site" (APK de luzalerts.lat, con
// autoactualización) o "play" (Google Play, sin autoactualización y sin
// REQUEST_INSTALL_PACKAGES). Lo fija eas.json por perfil; por defecto, site.
const DISTRIBUTION = process.env.DISTRIBUTION === "play" ? "play" : "site";
const IS_PLAY = DISTRIBUTION === "play";

module.exports = {
  expo: {
    name: "LuzAlerts",
    slug: "luzalerts",
    version: "1.2.7",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "dark",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#151718",
    },
    ios: {
      supportsTablet: true,
    },
    android: {
      package: "com.luzalerts.app",
      // versionCode — единственный источник истины для самообновления:
      // приложение сравнивает его с web/dl/latest.json. Инкрементировать
      // при каждом релизе APK, иначе обновление никому не приедет.
      versionCode: 21,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#151718",
      },
      edgeToEdgeEnabled: true,
      // Instalar el APK por nuestra cuenta solo hace falta en la build del sitio.
      // Google Play prohíbe que la app se actualice por fuera de la tienda: en
      // play el permiso no se pide y además se quita del manifiesto final
      // (blockedPermissions = tools:node="remove"), aunque lo traiga alguna
      // librería.
      permissions: IS_PLAY ? [] : ["REQUEST_INSTALL_PACKAGES"],
      ...(IS_PLAY ? { blockedPermissions: ["android.permission.REQUEST_INSTALL_PACKAGES"] } : {}),
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            { scheme: "https", host: "luzalerts.lat", pathPrefix: "/r" },
            // Отключения ANDE, которыми делятся в WhatsApp (/o/{id}). Со слэшем:
            // иначе приложение перехватывало бы и /og-report.png.
            { scheme: "https", host: "luzalerts.lat", pathPrefix: "/o/" },
          ],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY,
        },
      },
    },
    scheme: "luzalerts",
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro",
    },
    // PWA для iPhone живет на luzalerts.lat/app (лендинг занимает корень).
    // Влияет только на web-сборку: пути бандлов и маршрутов expo-router.
    experiments: {
      baseUrl: "/app",
    },
    plugins: [
      "expo-router",
      [
        "expo-notifications",
        {
          icon: "./assets/icon.png",
          color: "#F59E0B",
        },
      ],
    ],
    extra: {
      router: {},
      distribution: DISTRIBUTION,
      eas: {
        projectId: "e7df9178-6158-48fd-8075-bd20ec3dc622",
      },
    },
  },
};
