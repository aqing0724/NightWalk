import { useState } from "react";
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
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { auth, db } from "../firebase";

const theftIcon = require("../assets/Theft.png");
const harassIcon = require("../assets/Harass.png");
const trackIcon = require("../assets/Track.png");
const faceIcon = require("../assets/Face.png");
const imageIcon = require("../assets/image.png");

const reportLocation = {
  latitude: 24.988,
  longitude: 121.576,
  latitudeDelta: 0.0038,
  longitudeDelta: 0.0038,
};

const dangerTypes = [
  { id: "theft", label: "偷竊", icon: theftIcon },
  { id: "harass", label: "騷擾", icon: harassIcon },
  { id: "track", label: "跟蹤", icon: trackIcon },
];

const dangerLevels = ["需注意", "需小心", "極度危險"];

export default function AddPage() {
  const insets = useSafeAreaInsets();
  const [selectedLocation, setSelectedLocation] = useState(reportLocation);
  const [locationText, setLocationText] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [dangerLevel, setDangerLevel] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    if (
      !locationText.trim() ||
      !description.trim() ||
      selectedTypes.length === 0 ||
      !dangerLevel
    ) {
      Alert.alert("資料未完成", "請填寫位置、危險類型、危險程度與情況說明。");
      return;
    }

    setIsSubmitting(true);

    try {
      await addDoc(collection(db, "reports"), {
        locationText: locationText.trim(),
        description: description.trim(),
        types: selectedTypes,
        dangerLevel,
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        credibleCount: 0,
        notCredibleCount: 0,
        userId: auth.currentUser?.uid ?? null,
        createdAt: serverTimestamp(),
      });

      setLocationText("");
      setDescription("");
      setSelectedTypes([]);
      setDangerLevel("");
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
          <MapView
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={reportLocation}
            scrollEnabled
            zoomEnabled
            rotateEnabled
            pitchEnabled
            toolbarEnabled={false}
            showsCompass={false}
            showsMyLocationButton={false}
            onRegionChangeComplete={(region) => setSelectedLocation(region)}
          >
            <Marker
              coordinate={{
                latitude: selectedLocation.latitude,
                longitude: selectedLocation.longitude,
              }}
              pinColor="#E94243"
            />
          </MapView>
        </View>

        <Text style={styles.sectionTitle}>1.大概位置描述</Text>
        <TextInput
          accessibilityLabel="Describe approximate location"
          multiline
          placeholder="ex.捷運xx站x號出口附近、xx大樓附近"
          placeholderTextColor="#000000"
          style={styles.largeInput}
          textAlignVertical="top"
          value={locationText}
          onChangeText={setLocationText}
        />

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

        <Text style={styles.sectionTitle}>3.危險程度</Text>
        <View style={styles.optionRow}>
          {dangerLevels.map((level) => (
            <Pressable
              key={level}
              accessibilityLabel={level}
              accessibilityRole="radio"
              accessibilityState={{ checked: dangerLevel === level }}
              onPress={() => setDangerLevel(level)}
              style={[
                styles.optionCard,
                dangerLevel === level ? styles.optionCardSelected : null,
              ]}
            >
              <Image source={faceIcon} style={styles.faceIcon} />
              <Text style={styles.optionLabel}>{level}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>4.情況說明</Text>
        <TextInput
          accessibilityLabel="Describe situation"
          multiline
          placeholder="請簡單描述您看到的情況..."
          placeholderTextColor="#000000"
          style={styles.largeInput}
          textAlignVertical="top"
          value={description}
          onChangeText={setDescription}
        />

        <Text style={styles.sectionTitle}>5.上傳照片 (選填)</Text>
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
  },
  faceIcon: {
    width: 32,
    height: 32,
    resizeMode: "contain",
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
    color: "#BDBDBD",
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
