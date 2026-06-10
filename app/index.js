import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import * as Location from "expo-location";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DangerAreaCard from "./components/DangerAreaCard";
import DangerAreaSheet from "./components/DangerAreaSheet";
import { colors, fontSizes } from "./constants/theme";
import { db } from "../firebase";
import { useTheme } from "./ThemeContext"; // 🎯 確保這行是單獨、乾淨的一行，直接貼在 db 下方

const centerIcon = require("../assets/location-crosshairs.png");
const typeMarkerImage = require("../assets/TypeMarker.png");
const appIcon = require("../assets/APPIcon.png");

const fallbackCenter = {
  latitude: 24.988,
  longitude: 121.576,
};

const cameraSettings = {
  pitch: 0,
  heading: 0,
  zoom: 18,
};

const fallbackSheetHeight = 360;
const tileSize = 256;
const minimumLaunchScreenDuration = 1800;

const locationOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
};
const typeLabels = {
  theft: "偷竊",
  harass: "騷擾",
  track: "跟蹤",
};
const customTypePrefix = "custom:";

let cachedUserCenter = null;
let hasShownLaunchScreen = false;

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

function formatMarkerType(type) {
  if (typeof type !== "string") {
    return "未分類";
  }

  if (type.startsWith(customTypePrefix)) {
    return type.replace(customTypePrefix, "") || "未分類";
  }

  return typeLabels[type] || type || "未分類";
}

function getMarkerTypeLabel(report) {
  return formatMarkerType(report?.markerType || report?.types?.[0]);
}

function coordinateToWorldPoint(coordinate, zoom) {
  const scale = tileSize * 2 ** zoom;
  const sinLatitude = Math.sin((coordinate.latitude * Math.PI) / 180);
  const safeSinLatitude = Math.min(Math.max(sinLatitude, -0.9999), 0.9999);

  return {
    x: ((coordinate.longitude + 180) / 360) * scale,
    y:
      (0.5 -
        Math.log((1 + safeSinLatitude) / (1 - safeSinLatitude)) /
          (4 * Math.PI)) *
      scale,
  };
}

function worldPointToCoordinate(point, zoom) {
  const scale = tileSize * 2 ** zoom;
  const longitude = (point.x / scale) * 360 - 180;
  const mercatorLatitude = Math.PI - (2 * Math.PI * point.y) / scale;
  const latitude =
    (2 * Math.atan(Math.exp(mercatorLatitude)) - Math.PI / 2) *
    (180 / Math.PI);

  return {
    latitude,
    longitude,
  };
}

export default function Page() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { themeMode, colors: themeColors } = useTheme();
  const mapRef = useRef(null);
  const shouldShowLaunchScreen = useRef(!hasShownLaunchScreen).current;
  const launchProgress = useRef(
    new Animated.Value(shouldShowLaunchScreen ? 0 : 1)
  ).current;
  const [minimumLaunchTimeElapsed, setMinimumLaunchTimeElapsed] =
    useState(!shouldShowLaunchScreen);
  const [isLaunchScreenVisible, setIsLaunchScreenVisible] = useState(
    shouldShowLaunchScreen
  );
  const [initialMapCenter, setInitialMapCenter] = useState(cachedUserCenter);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
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
  const launchProgressWidth = launchProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  useEffect(() => {
    if (!shouldShowLaunchScreen) {
      return undefined;
    }

    hasShownLaunchScreen = true;

    const progressAnimation = Animated.timing(launchProgress, {
      toValue: 0.85,
      duration: minimumLaunchScreenDuration,
      useNativeDriver: false,
    });
    const launchScreenTimer = setTimeout(() => {
      setMinimumLaunchTimeElapsed(true);
    }, minimumLaunchScreenDuration);

    progressAnimation.start();

    return () => {
      clearTimeout(launchScreenTimer);
      progressAnimation.stop();
    };
  }, [launchProgress, shouldShowLaunchScreen]);

  useEffect(() => {
    if (
      !initialMapCenter ||
      !minimumLaunchTimeElapsed ||
      !isLaunchScreenVisible
    ) {
      return undefined;
    }

    const completionAnimation = Animated.timing(launchProgress, {
      toValue: 1,
      duration: 250,
      useNativeDriver: false,
    });

    completionAnimation.start(({ finished }) => {
      if (finished) {
        setIsLaunchScreenVisible(false);
      }
    });

    return () => completionAnimation.stop();
  }, [
    initialMapCenter,
    isLaunchScreenVisible,
    launchProgress,
    minimumLaunchTimeElapsed,
  ]);

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

  function handleOpenReportSheet(report) {
    if (!report) {
      return;
    }

    setSelectedReportId(report.id);
    setDangerSheetVisible(true);
  }

  function focusReportOnMap(report) {
    if (!report) {
      return;
    }

    const reportCenter = {
      latitude: report.latitude,
      longitude: report.longitude,
    };
    const hiddenHeight = sheetHeight || fallbackSheetHeight;
    const visibleTop = Math.max(insets.top, 16);
    const visibleBottom = Math.max(visibleTop, screenHeight - hiddenHeight);
    const targetPoint = {
      x: screenWidth / 2,
      y: (visibleTop + visibleBottom) / 2,
    };
    const screenCenterPoint = {
      x: screenWidth / 2,
      y: screenHeight / 2,
    };
    const reportPoint = coordinateToWorldPoint(
      reportCenter,
      cameraSettings.zoom
    );
    const center = worldPointToCoordinate(
      {
        x: reportPoint.x + screenCenterPoint.x - targetPoint.x,
        y: reportPoint.y + screenCenterPoint.y - targetPoint.y,
      },
      cameraSettings.zoom
    );

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
    <View
      style={[
        styles.container,
        { backgroundColor: themeColors.background },
      ]}
    >
      {initialMapCenter ? (
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={[
            styles.map,
            { backgroundColor: themeColors.background },
          ]}
          userInterfaceStyle={themeMode} 
          customMapStyle={themeMode === "dark" ? googleMapDarkStyle : []} 
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
          onMapLoaded={() => setIsMapLoaded(true)}
          onUserLocationChange={handleUserLocationChange}
        >
          {reports.map((report) => (
            <Marker
              key={report.id}
              coordinate={{
                latitude: report.latitude,
                longitude: report.longitude,
              }}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={Platform.OS === "ios"}
              zIndex={1}
              onPress={() => handleOpenReportSheet(report)}
            >
              <View style={styles.reportMarker}>
                <Image
                  source={typeMarkerImage}
                  style={styles.reportMarkerImage}
                />
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  style={styles.reportMarkerText}
                >
                  #{getMarkerTypeLabel(report)}
                </Text>
              </View>
            </Marker>
          ))}
        </MapView>
      ) : null}

      {!isMapLoaded ? (
        <View
          pointerEvents="none"
          style={[
            styles.mapLoadingCover,
            { backgroundColor: themeColors.background },
          ]}
        />
      ) : null}

      <Modal
        animationType="none"
        navigationBarTranslucent
        statusBarTranslucent
        visible={isLaunchScreenVisible}
      >
        <View
          accessibilityLabel="NightWalk, Safer Routes, Safer Nights."
          accessibilityLiveRegion="polite"
          style={[
            styles.locatingOverlay,
            { backgroundColor: themeColors.background },
          ]}
        >
          <Image source={appIcon} style={styles.locatingAppIcon} />
          <Text
            style={[
              styles.locatingTagline,
              {
                color:
                  themeMode === "dark"
                    ? themeColors.white
                    : themeColors.black,
              },
            ]}
          >
            Safer Routes, Safer Nights.
          </Text>
          <View
            accessibilityLabel="定位進度"
            accessibilityRole="progressbar"
            style={[
              styles.locatingProgressTrack,
              { backgroundColor: themeColors.specialSoft },
            ]}
          >
            <Animated.View
              style={[
                styles.locatingProgressFill,
                {
                  width: launchProgressWidth,
                  backgroundColor: themeColors.special,
                },
              ]}
            />
          </View>
        </View>
      </Modal>

      {initialMapCenter && !isLaunchScreenVisible ? (
        <>
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
                  handleOpenReportSheet(nearestReport);
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
              { bottom: dangerCardBottom + 75 + 28 },
              pressed ? styles.recenterButtonPressed : null,
            ]}
          >
            <Image source={centerIcon} style={styles.recenterIcon} />
          </Pressable>
        </>
      ) : null}

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
    backgroundColor: colors.black,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapLoadingCover: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  locatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 34,
  },
  locatingAppIcon: {
    width: 144,
    height: 144,
    resizeMode: "contain",
  },
  locatingTagline: {
    marginTop: 20,
    color: colors.black,
    fontSize: fontSizes.bodyLarge,
    fontWeight: "700",
    textAlign: "center",
  },
  locatingProgressTrack: {
    width: 180,
    height: 10,
    marginTop: 24,
    overflow: "hidden",
    borderRadius: 10,
    backgroundColor: colors.specialSoft,
  },
  locatingProgressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: colors.special,
  },
  reportMarker: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  reportMarkerImage: {
    position: "absolute",
    width: 64,
    height: 64,
    resizeMode: "contain",
  },
  reportMarkerText: {
    position: "absolute",
    top: 15,
    width: 49,
    color: colors.white,
    fontSize: fontSizes.subtitle,
    fontWeight: "900",
    lineHeight: fontSizes.title,
    textAlign: "center",
  },
  dangerCard: {
    position: "absolute",
    left: 20,
    right: 20,
    zIndex: 2,
  },
  recenterButton: {
    position: "absolute",
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
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
// 🎯 請直接貼在檔案最底部（styles 的大括號外面）

const googleMapDarkStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#212121" }] },
  { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#757575" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#181818" }] },
  { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#8a8a8a" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] }
];
