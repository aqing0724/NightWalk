import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { auth, db, storage } from "../firebase";
import { colors, fontSizes } from "./constants/theme";

const theftIcon = require("../assets/Theft.png");
const harassIcon = require("../assets/Harass.png");
const trackIcon = require("../assets/Track.png");
const imageIcon = require("../assets/image.png");
const mapPinIcon = require("../assets/marker.png");

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
const maxPhotoCount = 5;

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

function formatCurrentAddress(address) {
  if (address.formattedAddress) {
    return address.formattedAddress;
  }

  return [
    address.country,
    address.region,
    address.city,
    address.district,
    address.street,
    address.streetNumber,
    address.name,
  ]
    .filter((part, index, parts) => part && parts.indexOf(part) === index)
    .join("");
}

async function uploadImageAsync(imageUri) {
  const user = auth.currentUser;
  const userId = user?.uid || "anonymous";
  const imagePath = `reports/${userId}/${Date.now()}.jpg`;
  const imageRef = ref(storage, imagePath);

  try {
    if (!user) {
      throw new Error("auth-required");
    }

    const idToken = await user.getIdToken();
    const bucket = storage.app.options.storageBucket;
    const fileInfo = await FileSystem.getInfoAsync(imageUri);

    if (!fileInfo.exists || typeof fileInfo.size !== "number") {
      throw new Error("image-file-unavailable");
    }

    const createUploadUrl =
      `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o` +
      `?name=${encodeURIComponent(imagePath)}`;
    const createUploadResult = await fetch(createUploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Firebase ${idToken}`,
        "Content-Type": "application/json; charset=utf-8",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": `${fileInfo.size}`,
        "X-Goog-Upload-Header-Content-Type": "image/jpeg",
        "X-Goog-Upload-Protocol": "resumable",
      },
      body: JSON.stringify({
        name: imagePath,
        bucket,
        contentType: "image/jpeg",
      }),
    });
    const resumableUploadUrl = createUploadResult.headers.get(
      "X-Goog-Upload-URL"
    );

    if (!createUploadResult.ok || !resumableUploadUrl) {
      const uploadError = new Error(
        "Firebase Storage could not start the upload."
      );
      uploadError.code = `storage/http-${createUploadResult.status}`;
      uploadError.serverResponse = await createUploadResult.text();
      throw uploadError;
    }

    const uploadResult = await FileSystem.uploadAsync(
      resumableUploadUrl,
      imageUri,
      {
        httpMethod: "POST",
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          Authorization: `Firebase ${idToken}`,
          "Content-Type": "image/jpeg",
          "X-Goog-Upload-Command": "upload, finalize",
          "X-Goog-Upload-Offset": "0",
        },
      }
    );

    if (uploadResult.status < 200 || uploadResult.status >= 300) {
      const uploadError = new Error("Firebase Storage upload failed.");
      uploadError.code = `storage/http-${uploadResult.status}`;
      uploadError.serverResponse = uploadResult.body;
      throw uploadError;
    }

    return getDownloadURL(imageRef);
  } catch (error) {
    console.log("Storage error code:", error.code);
    console.log("Storage error message:", error.message);
    console.log("Storage server response:", error.serverResponse);
    throw error;
  }
}

function getUploadErrorMessage(error) {
  switch (error.code) {
    case "storage/unauthorized":
      return "Firebase Storage 拒絕上傳。請確認 Storage Rules 已發布，且目前帳號已登入。";
    case "storage/bucket-not-found":
      return "找不到 Firebase Storage bucket。請確認 Firebase Console 已建立 Storage。";
    case "storage/quota-exceeded":
      return "Firebase Storage 額度已用完，請檢查 Firebase 方案與使用量。";
    case "storage/retry-limit-exceeded":
      return "上傳逾時，請確認網路連線後再試一次。";
    case "storage/unknown":
      return "Firebase Storage 回傳未知錯誤。請檢查終端機中的 serverResponse，並確認 Storage 已啟用 Blaze 方案。";
    default:
      return "目前無法送出回報，請稍後再試。";
  }
}

export default function AddPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const hasSearchedLocationRef = useRef(false);
  const hasEditedLocationTextRef = useRef(false);
  const isSearchingLocationRef = useRef(false);
  const pulseAnimation = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0.65)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const successNavigationTimeoutRef = useRef(null);
  const [selectedLocation, setSelectedLocation] = useState(reportLocation);
  const [mapRegion, setMapRegion] = useState(reportRegion);
  const [selectedAddress, setSelectedAddress] = useState("");
  const [locationText, setLocationText] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStage, setSubmissionStage] = useState("idle");
  const [isFindingLocation, setIsFindingLocation] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [locationRefreshCount, setLocationRefreshCount] = useState(0);

  useEffect(() => {
    if (submissionStage === "submitting") {
      pulseAnimation.setValue(0);
      const animation = Animated.loop(
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        })
      );

      animation.start();
      return () => animation.stop();
    }

    if (submissionStage === "success") {
      successScale.setValue(0.65);
      successOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(successScale, {
          toValue: 1,
          friction: 5,
          tension: 90,
          useNativeDriver: true,
        }),
        Animated.timing(successOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [
    pulseAnimation,
    submissionStage,
    successOpacity,
    successScale,
  ]);

  useEffect(
    () => () => {
      if (successNavigationTimeoutRef.current) {
        clearTimeout(successNavigationTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthChecked(true);

      if (!user) {
        setIsFindingLocation(false);
        setIsRefreshing(false);
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

        if (!hasEditedLocationTextRef.current) {
          setLocationText("目前位置");
        }

        try {
          const addresses = await Location.reverseGeocodeAsync({
            latitude: userRegion.latitude,
            longitude: userRegion.longitude,
          });
          const currentAddress = addresses[0]
            ? formatCurrentAddress(addresses[0])
            : "";

          if (
            isMounted &&
            currentAddress &&
            !hasEditedLocationTextRef.current
          ) {
            setLocationText(currentAddress);
            setSelectedAddress(currentAddress);
          }
        } catch {
          // Keep "目前位置" if a readable address is unavailable.
        }
      } catch {
        // Keep the fallback location if current location is unavailable.
      } finally {
        if (isMounted) {
          setIsFindingLocation(false);
          setIsRefreshing(false);
        }
      }
    }

    centerMapOnUserLocation();

    return () => {
      isMounted = false;
    };
  }, [authChecked, currentUser, locationRefreshCount]);

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

  function handleLocationInputFocus() {
    if (!hasEditedLocationTextRef.current) {
      setLocationText("");
    }
  }

  function handleLocationInputBlur() {
    if (!locationText.trim()) {
      hasEditedLocationTextRef.current = false;
      setLocationText(selectedAddress || "目前位置");
      return;
    }

    handleSearchLocation();
  }

  function handleRefresh() {
    if (isSubmitting) {
      return;
    }

    hasSearchedLocationRef.current = false;
    hasEditedLocationTextRef.current = false;
    isSearchingLocationRef.current = false;
    setSelectedLocation(reportLocation);
    setMapRegion(reportRegion);
    setSelectedAddress("");
    setLocationText("");
    setDescription("");
    setSelectedTypes([]);
    setSelectedImages([]);
    setIsSearchingLocation(false);
    setIsFindingLocation(true);
    setIsRefreshing(true);
    setLocationRefreshCount((currentCount) => currentCount + 1);
  }

  function toggleDangerType(typeId) {
    setSelectedTypes((currentTypes) =>
      currentTypes.includes(typeId)
        ? currentTypes.filter((id) => id !== typeId)
        : [...currentTypes, typeId]
    );
  }

  function addSelectedImages(images) {
    setSelectedImages((currentImages) => [
      ...currentImages,
      ...images.slice(0, maxPhotoCount - currentImages.length),
    ]);
  }

  async function pickImageFromCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("需要相機權限", "請允許 NightWalk 使用相機後再試一次。");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });

    if (!result.canceled) {
      addSelectedImages(result.assets);
    }
  }

  async function pickImagesFromLibrary() {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("需要照片權限", "請允許 NightWalk 讀取照片後再試一次。");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: maxPhotoCount - selectedImages.length,
      quality: 0.8,
    });

    if (!result.canceled) {
      addSelectedImages(result.assets);
    }
  }

  function handleAddPhoto() {
    if (selectedImages.length >= maxPhotoCount) {
      Alert.alert("已達上限", `每次回報最多可上傳 ${maxPhotoCount} 張照片。`);
      return;
    }

    Alert.alert("新增圖片", "請選擇照片來源", [
      {
        text: "拍照",
        onPress: () => handlePickImage(pickImageFromCamera),
      },
      {
        text: "從圖庫選擇",
        onPress: () => handlePickImage(pickImagesFromLibrary),
      },
      { text: "取消", style: "cancel" },
    ]);
  }

  async function handlePickImage(pickImage) {
    if (isPickingImage) {
      return;
    }

    setIsPickingImage(true);

    try {
      await pickImage();
    } catch {
      Alert.alert("無法新增圖片", "目前無法讀取照片，請稍後再試。");
    } finally {
      setIsPickingImage(false);
    }
  }

  function removeSelectedImage(indexToRemove) {
    setSelectedImages((currentImages) =>
      currentImages.filter((_, index) => index !== indexToRemove)
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
    setSubmissionStage("submitting");
    let reportSubmitted = false;

    try {
      const imageUrls = [];

      for (const image of selectedImages) {
        imageUrls.push(await uploadImageAsync(image.uri));
      }

      await addDoc(collection(db, "reports"), {
        locationText: locationText.trim(),
        selectedAddress,
        description: description.trim(),
        types: selectedTypes,
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        imageUrl: imageUrls[0] || "",
        imageUrls,
        credibleCount: 0,
        notCredibleCount: 0,
        userId: user.uid,
        createdAt: serverTimestamp(),
      });

      setLocationText("");
      setSelectedAddress("");
      setDescription("");
      setSelectedTypes([]);
      setSelectedImages([]);
      reportSubmitted = true;
      setSubmissionStage("success");
      successNavigationTimeoutRef.current = setTimeout(() => {
        setSubmissionStage("idle");
        setIsSubmitting(false);
        router.replace("/");
      }, 1400);
    } catch (error) {
      console.error("Failed to submit report:", {
        code: error.code,
        message: error.message,
        serverResponse: error.serverResponse || error.customData?.serverResponse,
      });
      setSubmissionStage("idle");
      Alert.alert("送出失敗", getUploadErrorMessage(error));
    } finally {
      if (!reportSubmitted) {
        setIsSubmitting(false);
      }
    }
  }

  return (
    <View style={styles.screen}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={colors.background}
      />

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
        {isRefreshing ? (
          <ActivityIndicator
            color={colors.special}
            size="small"
            style={styles.refreshIndicator}
          />
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 18) + 62,
            paddingBottom: Math.max(insets.bottom, 26) + 128,
          },
        ]}
        refreshControl={
          <RefreshControl
            colors={[colors.special]}
            enabled={!isSubmitting}
            onRefresh={handleRefresh}
            refreshing={isRefreshing}
            tintColor={colors.special}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mapCard}>
          {isFindingLocation ? (
            <View style={styles.locationPlaceholder}>
              <Text style={styles.locationOverlayText}>正在尋找定位...</Text>
            </View>
          ) : (
            <>
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
              />
              <View pointerEvents="none" style={styles.centerMarker}>
                <Image source={mapPinIcon} style={styles.centerMarkerIcon} />
              </View>
            </>
          )}
        </View>

        <Text style={styles.sectionTitle}>1.大概位置描述</Text>
        <View style={styles.searchBox}>
          <TextInput
            accessibilityLabel="Search approximate location"
            autoCorrect={false}
            blurOnSubmit
            enablesReturnKeyAutomatically
            returnKeyType="search"
            style={styles.searchInput}
            value={locationText}
            onBlur={handleLocationInputBlur}
            onChangeText={(text) => {
              hasEditedLocationTextRef.current = true;
              setLocationText(text);
            }}
            onFocus={handleLocationInputFocus}
            onPressIn={handleLocationInputFocus}
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
          placeholderTextColor={colors.special}
          style={styles.largeInput}
          textAlignVertical="top"
          value={description}
          onChangeText={setDescription}
        />

        <Text style={styles.sectionTitle}>4.上傳照片 (選填)</Text>
        <Pressable
          accessibilityLabel="Add photo"
          accessibilityRole="button"
          disabled={isPickingImage}
          onPress={handleAddPhoto}
          style={[
            styles.photoButton,
            isPickingImage ? styles.photoButtonDisabled : null,
          ]}
        >
          <Image source={imageIcon} style={styles.photoIcon} />
          <Text style={styles.photoButtonText}>
            {isPickingImage ? "讀取中..." : "新增圖片"}
          </Text>
        </Pressable>
        {selectedImages.length ? (
          <>
            <ScrollView
              contentContainerStyle={styles.photoPreviewRow}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {selectedImages.map((image, index) => (
                <View key={`${image.uri}-${index}`} style={styles.photoPreview}>
                  <Image source={{ uri: image.uri }} style={styles.photoImage} />
                  <Pressable
                    accessibilityLabel={`Remove photo ${index + 1}`}
                    accessibilityRole="button"
                    onPress={() => removeSelectedImage(index)}
                    style={styles.removePhotoButton}
                  >
                    <Text style={styles.removePhotoText}>×</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
            <Text style={styles.photoCount}>
              已選擇 {selectedImages.length}/{maxPhotoCount} 張照片
            </Text>
          </>
        ) : null}

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

      <Modal
        animationType="fade"
        onRequestClose={() => {}}
        statusBarTranslucent
        transparent
        visible={submissionStage !== "idle"}
      >
        <View
          accessibilityLiveRegion="polite"
          accessibilityViewIsModal
          style={[
            styles.submissionOverlay,
            submissionStage === "success"
              ? styles.submissionOverlayCentered
              : { paddingTop: Math.max(insets.top, 18) + 96 },
          ]}
        >
          {submissionStage === "submitting" ? (
            <View style={styles.submissionCard}>
              <View style={styles.loadingAnimation}>
                <Animated.View
                  style={[
                    styles.loadingPulse,
                    {
                      opacity: pulseAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.55, 0],
                      }),
                      transform: [
                        {
                          scale: pulseAnimation.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.72, 1.45],
                          }),
                        },
                      ],
                    },
                  ]}
                />
                <ActivityIndicator color={colors.white} size="large" />
              </View>
              <Text style={styles.submissionTitle}>正在送出回報</Text>
              <Text style={styles.submissionDescription}>
                請稍候，我們正在上傳資料...
              </Text>
            </View>
          ) : (
            <View style={styles.submissionCard}>
              <Animated.View
                style={[
                  styles.successCircle,
                  {
                    opacity: successOpacity,
                    transform: [{ scale: successScale }],
                  },
                ]}
              >
                <Text style={styles.successCheck}>✓</Text>
              </Animated.View>
              <Text style={styles.submissionTitle}>回報成功送出</Text>
              <Text style={styles.submissionDescription}>
                謝謝你協助守護社區安全
              </Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
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
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    elevation: 10,
  },
  title: {
    color: colors.black,
    fontSize: fontSizes.heading,
    fontWeight: "900",
    lineHeight: 31,
    textAlign: "center",
  },
  refreshIndicator: {
    position: "absolute",
    bottom: -24,
  },
  mapCard: {
    height: 184,
    marginTop: 8,
    borderRadius: 4,
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  centerMarker: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -16 }, { translateY: -32 }],
  },
  centerMarkerIcon: {
    width: 32,
    height: 32,
    resizeMode: "contain",
  },
  locationPlaceholder: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  locationOverlayText: {
    color: colors.black,
    fontSize: fontSizes.bodyLarge,
    fontWeight: "900",
    lineHeight: 22,
  },
  sectionTitle: {
    marginTop: 32,
    color: colors.black,
    fontSize: fontSizes.title,
    fontWeight: "900",
    lineHeight: 26,
  },
  largeInput: {
    minHeight: 80,
    marginTop: 10,
    paddingTop: 14,
    paddingHorizontal: 11,
    borderRadius: 9,
    backgroundColor: colors.white,
    color: colors.black,
    fontSize: fontSizes.bodySmall,
    fontWeight: "800",
    lineHeight: 20,
  },
  searchBox: {
    height: 50,
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  searchInput: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 14,
    color: colors.black,
    fontSize: fontSizes.body,
    fontWeight: "800",
  },
  searchButton: {
    height: "100%",
    minWidth: 68,
    paddingHorizontal: 14,
    backgroundColor: colors.special,
    alignItems: "center",
    justifyContent: "center",
  },
  searchButtonDisabled: {
    opacity: 0.72,
  },
  searchButtonText: {
    color: colors.white,
    fontSize: fontSizes.body,
    fontWeight: "900",
  },
  selectedAddress: {
    marginTop: 8,
    color: colors.special,
    fontSize: fontSizes.labelSmall,
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
    borderColor: colors.white,
    borderRadius: 8,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  optionCardSelected: {
    borderColor: colors.special,
    backgroundColor: colors.background,
  },
  dangerTypeIcon: {
    width: 34,
    height: 34,
    resizeMode: "contain",
    paddingTop:0,
  },
  optionLabel: {
    marginTop: 9,
    color: colors.black,
    fontSize: fontSizes.titleSmall,
    fontWeight: "900",
    lineHeight: 24,
    textAlign: "center",
  },
  moreText: {
    marginTop: 8,
    color: colors.black,
    fontSize: fontSizes.bodyLarge,
    fontWeight: "900",
    lineHeight: 21,
  },
  photoButton: {
    width: 110,
    height: 80,
    marginTop: 11,
    borderRadius: 8,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  photoButtonDisabled: {
    opacity: 0.7,
  },
  photoIcon: {
    width: 35,
    height: 35,
    marginBottom: 4,
    resizeMode: "contain",
  },
  photoButtonText: {
    color: colors.black,
    fontSize: fontSizes.titleSmall,
    fontWeight: "900",
    lineHeight: 24,
  },
  photoPreviewRow: {
    paddingTop: 12,
    paddingRight: 8,
  },
  photoPreview: {
    width: 88,
    height: 88,
    marginRight: 10,
  },
  photoImage: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
  removePhotoButton: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.black,
    alignItems: "center",
    justifyContent: "center",
  },
  removePhotoText: {
    color: colors.white,
    fontSize: fontSizes.title,
    fontWeight: "900",
    lineHeight: 22,
  },
  photoCount: {
    marginTop: 7,
    color: colors.special,
    fontSize: fontSizes.labelSmall,
    fontWeight: "800",
  },
  submitHint: {
    marginTop: 38,
    color: colors.special,
    fontSize: fontSizes.bodyLarge,
    fontWeight: "900",
    lineHeight: 21,
    textAlign: "center",
  },
  submitButton: {
    height: 43,
    marginTop: 13,
    borderRadius: 8,
    backgroundColor: colors.special,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: fontSizes.title,
    fontWeight: "900",
    lineHeight: 26,
  },
  submissionOverlay: {
    flex: 1,
    paddingHorizontal: 24,
    backgroundColor: "rgba(44, 48, 46, 0.66)",
    alignItems: "center",
  },
  submissionOverlayCentered: {
    justifyContent: "center",
  },
  submissionCard: {
    width: "100%",
    maxWidth: 340,
    paddingVertical: 26,
    paddingHorizontal: 20,
    borderRadius: 18,
    backgroundColor: "rgba(100, 125, 112, 0.96)",
    alignItems: "center",
  },
  loadingAnimation: {
    width: 76,
    height: 76,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingPulse: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.white,
  },
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  successCheck: {
    color: colors.special,
    fontSize: 45,
    fontWeight: "900",
    lineHeight: 52,
  },
  submissionTitle: {
    marginTop: 16,
    color: colors.white,
    fontSize: fontSizes.title,
    fontWeight: "900",
    lineHeight: 27,
    textAlign: "center",
  },
  submissionDescription: {
    marginTop: 7,
    color: colors.white,
    fontSize: fontSizes.bodySmall,
    fontWeight: "800",
    lineHeight: 20,
    textAlign: "center",
  },
});
