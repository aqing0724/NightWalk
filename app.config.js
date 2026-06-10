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
    "jsEngine": "jsc",
    "version": "1.0.0",
    androidNavigationBar: {
      backgroundColor: "#F7F7F7",
      barStyle: "dark-content",
    },
    ios: {
      config: {
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
      },
    },
    android: {
      softwareKeyboardLayoutMode: "pan",
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY,
        },
      },
    },
  },
};
