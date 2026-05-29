import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { auth, db } from "../firebase";

const theftIcon = require("../assets/Theft.png");
const harassIcon = require("../assets/Harass.png");
const trackIcon = require("../assets/Track.png");
const imageIcon = require("../assets/image.png");

const reportLocation = {
  latitude: 24.988,
  longitude: 121.576,
};

const reportRegion = {
  ...reportLocation,
  latitudeDelta: 0.0038,
  longitudeDelta: 0.0038,
};

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

const dangerTypes = [
  { id: "theft", label: "偷竊", icon: theftIcon },
  { id: "harass", label: "騷擾", icon: harassIcon },
  { id: "track", label: "跟蹤", icon: trackIcon },
];

function buildGeocodingQueries(searchText) {
  return [
    searchText,
    `${searchText} 台灣`,
    `${searchText} 台北市`,
    `台北 ${searchText}`,
  ];
}

async function geocodeAddress(searchText) {
  if (!googleMapsApiKey) {
    throw new Error("missing-api-key");
  }

  const queries = buildGeocodingQueries(searchText);

  for (const query of queries) {
    const url =
      "https://maps.googleapis.com/maps/api/geocode/json" +
      `?address=${encodeURIComponent(query)}` +
      "&language=zh-TW&region=tw&components=country:TW" +
      `&key=${googleMapsApiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "REQUEST_DENIED") {
      throw new Error("request-denied");
    }

    const result = data.results?.[0];
    const location = result?.geometry?.location;

    if (location) {
      return {
        address: result.formatted_address,
        latitude: location.lat,
        longitude: location.lng,
      };
    }
  }

  return null;
}

export default function AddPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const hasSearchedLocationRef = useRef(false);
  const isSearchingLocationRef = useRef(false);
  const [selectedLocation, setSelectedLocation] = useState(reportLocation);
  const [mapRegion, setMapRegion] = useState(reportRegion);
  const [selectedAddress, setSelectedAddress] = useState("");
  const [locationText, setLocationText] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFindingLocation, setIsFindingLocation] = useState(true);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthChecked(true);

      if (!user) {
        setIsFindingLocation(false);
        Alert.alert("請先登入", "登入後才能新增危險地點回報。", [
          { text: "前往登入", onPress: () => router.replace("/Login") },
        ]);
      }
    });

    return unsubscribe;
  }, [router]);

  useEffect(() => {
    if (!authChecked || !currentUser) {
      return;
    }

    let isMounted = true;

    async function centerMapOnUserLocation() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (!isMounted || status !== "granted") {
          setIsFindingLocation(false);
          return;
        }

        const userLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!isMounted) {
          return;
        }

        const userRegion = {
          latitude: userLocation.coords.latitude,
          longitude: userLocation.coords.longitude,
          latitudeDelta: reportRegion.latitudeDelta,
          longitudeDelta: reportRegion.longitudeDelta,
        };

        if (hasSearchedLocationRef.current) {
          return;
        }

        setSelectedLocation({
          latitude: userRegion.latitude,
          longitude: userRegion.longitude,
        });
        setMapRegion(userRegion);
        mapRef.current?.animateToRegion(userRegion, 500);
      } catch {
        // Keep the fallback location if current location is unavailable.
      } finally {
        if (isMounted) {
          setIsFindingLocation(false);
        }
      }
    }

    centerMapOnUserLocation();

    return () => {
      isMounted = false;
    };
  }, [authChecked, currentUser]);

  async function handleSearchLocation() {
    const searchText = locationText.trim();

    if (searchText.length < 2 || isSearchingLocationRef.current) {
      return;
    }

    isSearchingLocationRef.current = true;
    hasSearchedLocationRef.current = true;
    setIsSearchingLocation(true);

    try {
      const result = await geocodeAddress(searchText);

      if (!result) {
        Alert.alert("找不到地點", "請輸入更完整的地點名稱。");
        return;
      }

      const nextLocation = {
        latitude: result.latitude,
        longitude: result.longitude,
      };
      const nextRegion = {
        ...nextLocation,
        latitudeDelta: reportRegion.latitudeDelta,
        longitudeDelta: reportRegion.longitudeDelta,
      };

      setSelectedAddress(result.address);
      setSelectedLocation(nextLocation);
      setMapRegion(nextRegion);
      setIsFindingLocation(false);
      mapRef.current?.animateToRegion(nextRegion, 600);
    } catch (error) {
      if (error.message === "missing-api-key") {
        Alert.alert(
          "缺少 Google API Key",
          "請在 .env 設定 EXPO_PUBLIC_GOOGLE_MAPS_API_KEY。"
        );
        return;
      }

      if (error.message === "request-denied") {
        Alert.alert(
          "Google Geocoding API 無法使用",
          "請確認 API key 正確，並已啟用 Geocoding API。"
        );
        return;
      }

      Alert.alert("搜尋失敗", "目前無法搜尋這個地點，請稍後再試。");
    } finally {
      isSearchingLocationRef.current = false;
      setIsSearchingLocation(false);
    }
  }

  function toggleDangerType(typeId) {
    setSelectedTypes((currentTypes) =>
      currentTypes.includes(typeId)
        ? currentTypes.filter((id) => id !== typeId)
        : [...currentTypes, typeId]
    );
  }

  async function handleSubmitReport() {
    if (isSubmitting) {
      return;
    }

    const user = auth.currentUser;

    if (!user) {
      Alert.alert("請先登入", "登入後才能新增危險地點回報。", [
        { text: "前往登入", onPress: () => router.replace("/Login") },
      ]);
      return;
    }

    if (
      !locationText.trim() ||
      !description.trim() ||
      selectedTypes.length === 0
    ) {
      Alert.alert("資料未完成", "請填寫位置、危險類型與情況說明。");
      return;
    }

    setIsSubmitting(true);

    try {
      await addDoc(collection(db, "reports"), {
        locationText: locationText.trim(),
        selectedAddress,
        description: description.trim(),
        types: selectedTypes,
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        credibleCount: 0,
        notCredibleCount: 0,
        userId: user.uid,
        createdAt: serverTimestamp(),
      });

      setLocationText("");
      setSelectedAddress("");
      setDescription("");
      setSelectedTypes([]);
      Alert.alert("已送出", "謝謝你的回報。");
    } catch (error) {
      Alert.alert("送出失敗", "目前無法送出回報，請稍後再試。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#F6F6F6" />

      <View
        style={[
          styles.header,
          {
            height: Math.max(insets.top, 18) + 54,
            paddingTop: Math.max(insets.top, 18),
          },
        ]}
      >
        <Text style={styles.title}>回報危險地點</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 18) + 62,
            paddingBottom: Math.max(insets.bottom, 26) + 128,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mapCard}>
          {isFindingLocation ? (
            <View style={styles.locationPlaceholder}>
              <Text style={styles.locationOverlayText}>正在尋找定位...</Text>
            </View>
          ) : (
            <MapView
              ref={mapRef}
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              initialRegion={mapRegion}
              region={mapRegion}
              scrollEnabled
              zoomEnabled
              rotateEnabled
              pitchEnabled
              toolbarEnabled={false}
              showsCompass={false}
              showsMyLocationButton={false}
              onRegionChangeComplete={(region) => {
                setMapRegion(region);
                setSelectedLocation({
                  latitude: region.latitude,
                  longitude: region.longitude,
                });
              }}
            >
              <Marker
                coordinate={{
                  latitude: selectedLocation.latitude,
                  longitude: selectedLocation.longitude,
                }}
                draggable
                pinColor="#E94243"
                onDragEnd={(event) => {
                  const nextLocation = event.nativeEvent.coordinate;
                  const nextRegion = {
                    latitude: nextLocation.latitude,
                    longitude: nextLocation.longitude,
                    latitudeDelta: mapRegion.latitudeDelta,
                    longitudeDelta: mapRegion.longitudeDelta,
                  };

                  setSelectedAddress("");
                  setSelectedLocation(nextLocation);
                  setMapRegion(nextRegion);
                  mapRef.current?.animateToRegion(nextRegion, 300);
                }}
              />
            </MapView>
          )}
        </View>

        <Text style={styles.sectionTitle}>1.大概位置描述</Text>
        <View style={styles.searchBox}>
          <TextInput
            accessibilityLabel="Search approximate location"
            autoCorrect={false}
            blurOnSubmit
            enablesReturnKeyAutomatically
            placeholder="搜尋地點，例如：捷運科技大樓站"
            placeholderTextColor="#B8B6B6"
            returnKeyType="search"
            style={styles.searchInput}
            value={locationText}
            onBlur={handleSearchLocation}
            onChangeText={setLocationText}
            onSubmitEditing={handleSearchLocation}
          />
          <Pressable
            accessibilityLabel="Search location"
            accessibilityRole="button"
            disabled={isSearchingLocation}
            onPress={handleSearchLocation}
            style={[
              styles.searchButton,
              isSearchingLocation ? styles.searchButtonDisabled : null,
            ]}
          >
            <Text style={styles.searchButtonText}>
              {isSearchingLocation ? "搜尋中" : "搜尋"}
            </Text>
          </Pressable>
        </View>
        {selectedAddress ? (
          <Text style={styles.selectedAddress}>{selectedAddress}</Text>
        ) : null}

        <Text style={styles.sectionTitle}>2.選擇危險類型(可複選)</Text>
        <View style={styles.optionRow}>
          {dangerTypes.map((item) => (
            <Pressable
              key={item.id}
              accessibilityLabel={item.label}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selectedTypes.includes(item.id) }}
              onPress={() => toggleDangerType(item.id)}
              style={[
                styles.optionCard,
                selectedTypes.includes(item.id)
                  ? styles.optionCardSelected
                  : null,
              ]}
            >
              <Image source={item.icon} style={styles.dangerTypeIcon} />
              <Text style={styles.optionLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.moreText}>更多...</Text>

        <Text style={styles.sectionTitle}>3.情況說明</Text>
        <TextInput
          accessibilityLabel="Describe situation"
          multiline
          placeholder="請簡單描述您看到的情況..."
          placeholderTextColor="#B8B6B6"
          style={styles.largeInput}
          textAlignVertical="top"
          value={description}
          onChangeText={setDescription}
        />

        <Text style={styles.sectionTitle}>4.上傳照片 (選填)</Text>
        <Pressable
          accessibilityLabel="Add photo"
          accessibilityRole="button"
          style={styles.photoButton}
        >
          <Image source={imageIcon} style={styles.photoIcon} />
          <Text style={styles.photoButtonText}>新增圖片</Text>
        </Pressable>

        <Text style={styles.submitHint}>回報送出後不可編輯{"\n"}請再次確認您的資料是否無誤</Text>
        <Pressable
          accessibilityLabel="Submit report"
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={handleSubmitReport}
          style={[
            styles.submitButton,
            isSubmitting ? styles.submitButtonDisabled : null,
          ]}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? "送出中..." : "送出回報"}
          </Text>
        </Pressable>
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F6F6F6",
  },
  content: {
    paddingHorizontal: 20,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    backgroundColor: "#F6F6F6",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    elevation: 10,
  },
  title: {
    color: "#000000",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 31,
    textAlign: "center",
  },
  mapCard: {
    height: 184,
    marginTop: 8,
    borderRadius: 4,
    backgroundColor: "#E9E9E9",
    overflow: "hidden",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  locationPlaceholder: {
    flex: 1,
    backgroundColor: "#E9E9E9",
    alignItems: "center",
    justifyContent: "center",
  },
  locationOverlayText: {
    color: "#111111",
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 22,
  },
  sectionTitle: {
    marginTop: 32,
    color: "#000000",
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 26,
  },
  largeInput: {
    minHeight: 80,
    marginTop: 10,
    paddingTop: 14,
    paddingHorizontal: 11,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
    color: "#000000",
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
  },
  searchBox: {
    height: 50,
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  searchInput: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 14,
    color: "#000000",
    fontSize: 15,
    fontWeight: "800",
  },
  searchButton: {
    height: "100%",
    minWidth: 68,
    paddingHorizontal: 14,
    backgroundColor: "#AFC2B5",
    alignItems: "center",
    justifyContent: "center",
  },
  searchButtonDisabled: {
    opacity: 0.72,
  },
  searchButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  selectedAddress: {
    marginTop: 8,
    color: "#6F786F",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  optionRow: {
    marginTop: 11,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  optionCard: {
    width: "31%",
    height: 89,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  optionCardSelected: {
    borderColor: "#AFC2B5",
    backgroundColor: "#F4F8F5",
  },
  dangerTypeIcon: {
    width: 34,
    height: 34,
    resizeMode: "contain",
    paddingTop:0,
  },
  optionLabel: {
    marginTop: 9,
    color: "#000000",
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 24,
    textAlign: "center",
  },
  moreText: {
    marginTop: 8,
    color: "#000000",
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 21,
  },
  photoButton: {
    width: 110,
    height: 80,
    marginTop: 11,
    borderRadius: 8,
    backgroundColor: "#C6C6C6",
    alignItems: "center",
    justifyContent: "center",
  },
  photoIcon: {
    width: 35,
    height: 35,
    marginBottom: 4,
    resizeMode: "contain",
  },
  photoButtonText: {
    color: "#000000",
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 24,
  },
  submitHint: {
    marginTop: 38,
    color: "#B8B6B6",
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 21,
    textAlign: "center",
  },
  submitButton: {
    height: 43,
    marginTop: 13,
    borderRadius: 8,
    backgroundColor: "#AFC2B5",
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 26,
  },
});
