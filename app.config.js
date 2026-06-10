export default {
  expo: {
    scheme: "nightwalk",
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
    name: "NightWalk",
    slug: "nightwalk",
    jsEngine: "jsc",
    version: "1.0.0",
    updates: {
      url: "https://u.expo.dev/63ca09c2-3f46-4210-881d-9905f91a16bf",
    },

    runtimeVersion: {
      policy: "appVersion",
    },

    extra: {
      eas: {
        projectId: "63ca09c2-3f46-4210-881d-9905f91a16bf",
      },
    },

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
}