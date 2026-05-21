export default {
  expo: {
    scheme: "acme",
    plugins: [
      "expo-router",
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "Allow NightWalk to use your location to center the map.",
        },
      ],
    ],
    name: "nightwalk",
    slug: "nightwalk",
    ios: {
      bundleIdentifier: "com.nightwalk.app",
      config: {
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
      },
    },
    android: {
      package: "com.nightwalk.app",
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY,
        },
      },
    },
  },
};
