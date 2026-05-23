import { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import * as Location from "expo-location";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import DangerAreaCard from "./components/DangerAreaCard";
import DangerAreaSheet from "./components/DangerAreaSheet";
import { db } from "../firebase";

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
};

let cachedUserCenter = null;

const dangerLevelColors = {
  "需注意": "#F5C542",
  "需小心": "#F08A24",
  "極度危險": "#E94243",
};

function centerFromCoords(coords) {
  if (!coords) {
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
  const [mapCenter, setMapCenter] = useState(cachedUserCenter);
  const [reports, setReports] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [dangerSheetVisible, setDangerSheetVisible] = useState(false);
  const nearestReport = findNearestReport(reports, mapCenter);
  const selectedReport = selectedReportId
    ? reports.find((report) => report.id === selectedReportId)
    : null;
  const visibleReport = selectedReport || nearestReport;

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
              typeof report.latitude === "number" &&
              typeof report.longitude === "number"
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
      setMapCenter(nextCenter);
    }

    async function loadUserLocation() {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (!isMounted) {
        return;
      }

      if (status !== "granted") {
        if (!mapCenter) {
          setMapCenter(fallbackCenter);
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

      const currentLocation = await Location.getCurrentPositionAsync(
        locationOptions
      );

      if (isMounted) {
        saveUserCenter(currentLocation);
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
      setMapCenter(nextCenter);
    }
  }

  return (
    <View style={styles.container}>
      {mapCenter ? (
        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          userInterfaceStyle="dark"
          initialCamera={{
            center: mapCenter,
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
                setDangerSheetVisible(true);
              }}
            />
          ))}
        </MapView>
      ) : null}

      <View
        style={[
          styles.dangerCard,
          { bottom: Math.max(insets.bottom, 26) + 100 },
        ]}
      >
        <DangerAreaCard
          report={nearestReport}
          onPress={() => {
            if (nearestReport) {
              setSelectedReportId(null);
              setDangerSheetVisible(true);
            }
          }}
        />
      </View>

      <DangerAreaSheet
        visible={dangerSheetVisible}
        report={visibleReport}
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
});
