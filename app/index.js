import { useEffect, useRef, useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import * as Location from "expo-location";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import DangerAreaCard from "./components/DangerAreaCard";
import DangerAreaSheet from "./components/DangerAreaSheet";
import { db } from "../firebase";

const trackIcon = require("../assets/Track.png");

const fallbackCenter = {
  latitude: 24.988,
  longitude: 121.576,
};

const cameraSettings = {
  pitch: 60,
  heading: 330,
  zoom: 18,
};

const fallbackSheetHeight = 360;

const locationOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
};

let cachedUserCenter = null;

const dangerLevelColors = {
  "需注意": "#F5C542",
  "需小心": "#F08A24",
  "極度危險": "#E94243",
};

function isValidCoordinate(coordinate) {
  if (!coordinate) {
    return false;
  }

  const { latitude, longitude } = coordinate;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return false;
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return false;
  }

  return latitude !== 0 || longitude !== 0;
}

function centerFromCoords(coords) {
  if (!isValidCoordinate(coords)) {
    return null;
  }

  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
  };
}

function getDistanceInMeters(from, to) {
  if (!from || !to) {
    return Number.POSITIVE_INFINITY;
  }

  const earthRadius = 6371000;
  const toRadians = (value) => (value * Math.PI) / 180;
  const latitudeDistance = toRadians(to.latitude - from.latitude);
  const longitudeDistance = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const haversine =
    Math.sin(latitudeDistance / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDistance / 2) ** 2;

  return (
    earthRadius *
    2 *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

function findNearestReport(reports, center) {
  if (!reports.length || !center) {
    return null;
  }

  return reports.reduce((nearest, report) => {
    const reportDistance = getDistanceInMeters(center, report);

    if (!nearest || reportDistance < nearest.distanceMeters) {
      return {
        ...report,
        distanceMeters: reportDistance,
      };
    }

    return nearest;
  }, null);
}

export default function Page() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const mapRef = useRef(null);
  const [initialMapCenter, setInitialMapCenter] = useState(cachedUserCenter);
  const [userCenter, setUserCenter] = useState(cachedUserCenter);
  const [reports, setReports] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [dangerSheetVisible, setDangerSheetVisible] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(0);
  const dangerCardBottom = Math.max(insets.bottom, 26) + 100;
  const nearestReport = findNearestReport(reports, userCenter);
  const selectedReport = selectedReportId
    ? reports.find((report) => report.id === selectedReportId)
    : null;
  const visibleReport = selectedReport || nearestReport;

  useEffect(() => {
    if (dangerSheetVisible && visibleReport && sheetHeight) {
      focusReportOnMap(visibleReport);
    }
  }, [dangerSheetVisible, sheetHeight, visibleReport?.id]);

  useEffect(() => {
    const reportsQuery = query(
      collection(db, "reports"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(reportsQuery, (snapshot) => {
      setReports(
        snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter(
            (report) =>
              isValidCoordinate({
                latitude: report.latitude,
                longitude: report.longitude,
              })
          )
      );
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    let isMounted = true;

    function saveUserCenter(location) {
      const nextCenter = centerFromCoords(location?.coords);

      if (!nextCenter || !isMounted) {
        return;
      }

      cachedUserCenter = nextCenter;
      setUserCenter(nextCenter);
      setInitialMapCenter((currentCenter) => currentCenter || nextCenter);
    }

    async function loadUserLocation() {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (!isMounted) {
        return;
      }

      if (status !== "granted") {
        if (!initialMapCenter) {
          setInitialMapCenter(fallbackCenter);
        }
        return;
      }

      if (Platform.OS === "android") {
        try {
          await Location.enableNetworkProviderAsync();
        } catch {
          // The user can decline high accuracy mode; GPS updates can still continue.
        }
      }

      try {
        const currentLocation = await Location.getCurrentPositionAsync(
          locationOptions
        );

        if (isMounted) {
          saveUserCenter(currentLocation);
        }
      } catch {
        if (isMounted && !initialMapCenter) {
          setInitialMapCenter(fallbackCenter);
        }
      }
    }

    loadUserLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  function handleUserLocationChange(event) {
    const nextCenter = centerFromCoords(event.nativeEvent.coordinate);

    if (nextCenter) {
      cachedUserCenter = nextCenter;
      setUserCenter(nextCenter);
    }
  }

  async function focusReportOnMap(report) {
    if (!report) {
      return;
    }

    const reportCenter = {
      latitude: report.latitude,
      longitude: report.longitude,
    };
    const hiddenHeight = sheetHeight || fallbackSheetHeight;
    const targetPoint = {
      x: screenWidth / 2,
      y: Math.max(0, (screenHeight - hiddenHeight) / 2),
    };
    const screenCenterPoint = {
      x: screenWidth / 2,
      y: screenHeight / 2,
    };
    let center = reportCenter;

    try {
      const targetCoordinate =
        await mapRef.current?.coordinateForPoint(targetPoint);
      const screenCenterCoordinate =
        await mapRef.current?.coordinateForPoint(screenCenterPoint);

      if (
        isValidCoordinate(targetCoordinate) &&
        isValidCoordinate(screenCenterCoordinate)
      ) {
        center = {
          latitude:
            report.latitude +
            screenCenterCoordinate.latitude -
            targetCoordinate.latitude,
          longitude:
            report.longitude +
            screenCenterCoordinate.longitude -
            targetCoordinate.longitude,
        };
      }
    } catch {
      center = reportCenter;
    }

    mapRef.current?.animateCamera(
      {
        center,
        ...cameraSettings,
      },
      { duration: 650 }
    );
  }

  async function handleRecenterToUser() {
    let nextCenter = userCenter;

    if (!nextCenter) {
      try {
        const currentLocation = await Location.getCurrentPositionAsync(
          locationOptions
        );

        nextCenter = centerFromCoords(currentLocation.coords);
      } catch {
        nextCenter = null;
      }
    }

    if (!nextCenter) {
      return;
    }

    cachedUserCenter = nextCenter;
    setUserCenter(nextCenter);
    setInitialMapCenter((currentCenter) => currentCenter || nextCenter);

    mapRef.current?.animateCamera(
      {
        center: nextCenter,
        ...cameraSettings,
      },
      { duration: 450 }
    );
  }

  return (
    <View style={styles.container}>
      {initialMapCenter ? (
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          userInterfaceStyle="dark"
          initialCamera={{
            center: initialMapCenter,
            ...cameraSettings,
          }}
          showsUserLocation
          showsMyLocationButton={false}
          showsBuildings={false}
          showsIndoorLevelPicker={false}
          showsIndoors={false}
          toolbarEnabled={false}
          rotateEnabled
          pitchEnabled
          onUserLocationChange={handleUserLocationChange}
        >
          {reports.map((report) => (
            <Marker
              key={report.id}
              coordinate={{
                latitude: report.latitude,
                longitude: report.longitude,
              }}
              pinColor={dangerLevelColors[report.dangerLevel] ?? "#E94243"}
              title={report.locationText || "危險回報"}
              description={report.description}
              onPress={() => {
                setSelectedReportId(report.id);
                focusReportOnMap(report);
                setDangerSheetVisible(true);
              }}
            />
          ))}
        </MapView>
      ) : null}

      <View
        style={[
          styles.dangerCard,
          { bottom: dangerCardBottom },
        ]}
      >
        <DangerAreaCard
          report={nearestReport}
          onPress={() => {
            if (nearestReport) {
              setSelectedReportId(null);
              focusReportOnMap(nearestReport);
              setDangerSheetVisible(true);
            }
          }}
        />
      </View>

      <Pressable
        accessibilityLabel="回到目前位置"
        accessibilityRole="button"
        onPress={handleRecenterToUser}
        style={({ pressed }) => [
          styles.recenterButton,
          { bottom: dangerCardBottom + 75 + 14 },
          pressed ? styles.recenterButtonPressed : null,
        ]}
      >
        <Image source={trackIcon} style={styles.recenterIcon} />
      </Pressable>

      <DangerAreaSheet
        visible={dangerSheetVisible}
        report={visibleReport}
        onSheetLayout={setSheetHeight}
        onClose={() => {
          setDangerSheetVisible(false);
          setSelectedReportId(null);
        }}
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
  recenterButton: {
    position: "absolute",
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    zIndex: 3,
    elevation: 3,
  },
  recenterButtonPressed: {
    transform: [{ scale: 0.96 }],
  },
  recenterIcon: {
    width: 24,
    height: 24,
    resizeMode: "contain",
  },
});
