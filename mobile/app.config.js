module.exports = {
  expo: {
    name: "LuzAlerts",
    slug: "luzalerts",
    version: "1.1.5",
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
      versionCode: 9,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#151718",
      },
      edgeToEdgeEnabled: true,
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
      eas: {
        projectId: "e7df9178-6158-48fd-8075-bd20ec3dc622",
      },
    },
  },
};
