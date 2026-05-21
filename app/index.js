import { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import * as Location from "expo-location";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import DangerAreaCard from "./components/DangerAreaCard";
import DangerAreaSheet from "./components/DangerAreaSheet";

const fallbackCenter = {
  latitude: 24.988,
  longitude: 121.576,
};

const cameraSettings = {
  pitch: 60,
  heading: 330,
  zoom: 18,
};

const locationOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 1000,
  distanceInterval: 1,
};

export default function Page() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [dangerSheetVisible, setDangerSheetVisible] = useState(false);

  useEffect(() => {
    let subscription;
    let isMounted = true;

    function moveCameraToLocation(location, duration = 700) {
      if (!mapRef.current || !location?.coords) {
        return;
      }

      const nextUserLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        heading:
          typeof location.coords.heading === "number" &&
          location.coords.heading >= 0
            ? location.coords.heading
            : 0,
      };

      setUserLocation(nextUserLocation);

      mapRef.current.animateCamera(
        {
          center: {
            latitude: nextUserLocation.latitude,
            longitude: nextUserLocation.longitude,
          },
          ...cameraSettings,
        },
        { duration }
      );
    }

    async function startTrackingUser() {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (!isMounted || status !== "granted") {
        return;
      }

      if (Platform.OS === "android") {
        try {
          await Location.enableNetworkProviderAsync();
        } catch {
          // The user can decline high accuracy mode; GPS updates can still continue.
        }
      }

      const lastKnownLocation = await Location.getLastKnownPositionAsync({
        maxAge: 5000,
        requiredAccuracy: 50,
      });

      if (isMounted && lastKnownLocation) {
        moveCameraToLocation(lastKnownLocation, 300);
      }

      const currentLocation = await Location.getCurrentPositionAsync(
        locationOptions
      );

      if (isMounted) {
        moveCameraToLocation(currentLocation, 700);
      }

      subscription = await Location.watchPositionAsync(
        locationOptions,
        (location) => {
          if (isMounted) {
            moveCameraToLocation(location, 500);
          }
        }
      );
    }

    if (mapReady) {
      startTrackingUser();
    }

    return () => {
      isMounted = false;
      subscription?.remove();
    };
  }, [mapReady]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        userInterfaceStyle="dark"
        initialCamera={{
          center: fallbackCenter,
          ...cameraSettings,
        }}
        showsMyLocationButton={false}
        showsBuildings={false}
        showsIndoorLevelPicker={false}
        showsIndoors={false}
        toolbarEnabled={false}
        rotateEnabled
        pitchEnabled
        onMapReady={() => setMapReady(true)}
      >
        {userLocation ? (
          <Marker
            anchor={{ x: 0.5, y: 0.5 }}
            coordinate={{
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
            }}
            flat
            rotation={userLocation.heading}
          >
            <View style={styles.locationMarker}>
              <View style={styles.locationArrowWrap}>
                <View style={styles.locationArrow} />
              </View>
            </View>
          </Marker>
        ) : null}
      </MapView>

      <View
        style={[
          styles.dangerCard,
          { bottom: Math.max(insets.bottom, 26) + 100 },
        ]}
      >
        <DangerAreaCard onPress={() => setDangerSheetVisible(true)} />
      </View>

      <DangerAreaSheet
        visible={dangerSheetVisible}
        onClose={() => setDangerSheetVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  dangerCard: {
    position: "absolute",
    left: 20,
    right: 20,
    zIndex: 2,
    elevation: 2,
  },
  locationMarker: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255, 255, 255, 0.82)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  locationArrowWrap: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  locationArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderBottomWidth: 26,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#1a73e8",
  },
});
