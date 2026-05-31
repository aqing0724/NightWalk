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
      [
        "expo-image-picker",
        {
          photosPermission:
            "Allow NightWalk to access your photos for incident reports.",
          cameraPermission:
            "Allow NightWalk to use your camera for incident reports.",
          microphonePermission: false,
        },
      ],
    ],
    name: "nightwalk",
    slug: "nightwalk",
    ios: {
      config: {
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
      },
    },
    android: {
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY,
        },
      },
    },
  },
};
