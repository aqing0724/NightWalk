import { BlurView } from "expo-blur";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fontSizes } from "../constants/theme";

const redDangerIcon = require("../../assets/redDanger.png");
const faceIcon = require("../../assets/Face.png");
const pointRightIcon = require("../../assets/PointRight.png");

function formatDistance(distanceMeters) {
  if (typeof distanceMeters !== "number" || !Number.isFinite(distanceMeters)) {
    return "";
  }

  if (distanceMeters < 1000) {
    return `距離約 ${Math.max(1, Math.round(distanceMeters))} 公尺`;
  }

  return `距離約 ${(distanceMeters / 1000).toFixed(1)} 公里`;
}

export default function DangerAreaCard({ report, onPress }) {
  const subtitle = report
    ? report.locationText ||
      report.selectedAddress ||
      formatDistance(report.distanceMeters)
    : "附近目前沒有危險回報";
  const warningIcon = report ? redDangerIcon : faceIcon;
  const title = report ? "危險區域" : "安全區域";

  return (
    <Pressable
      accessibilityLabel="Danger area nearby"
      accessibilityRole="button"
      disabled={!report}
      onPress={onPress}
      style={({ pressed }) => [
        styles.cardFrame,
        pressed && report ? styles.cardPressed : null,
      ]}
    >
      <BlurView
        experimentalBlurMethod="dimezisBlurView"
        intensity={70}
        tint="systemMaterial"
        style={styles.card}
      >
        <View style={styles.iconBubble}>
          <Image source={warningIcon} style={styles.warningIcon} />
        </View>

        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
          {report ? (
            <Text style={styles.distance}>
              {formatDistance(report.distanceMeters)}
            </Text>
          ) : null}
        </View>

        <View style={styles.chevronBubble}>
          <Image source={pointRightIcon} style={styles.chevronIcon} />
        </View>
      </BlurView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardFrame: {
    height: 90,
    marginHorizontal: 0,
    borderRadius: 26,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 14,
    },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 14,
  },
  card: {
    width: "100%",
    height: "100%",
    overflow: "hidden",
    paddingHorizontal: 14,
    borderRadius: 26,
    backgroundColor: colors.glassDark,
    flexDirection: "row",
    alignItems: "center",
  },
  cardPressed: {
    transform: [{ scale: 0.985 }],
  },
  iconBubble: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
  },
  warningIcon: {
    width: 44,
    height: 44,
    resizeMode: "contain",
  },
  copy: {
    flex: 1,
    marginLeft: 14,
    justifyContent: "center",
  },
  title: {
    color: colors.black,
    fontSize: fontSizes.titleSmall,
    fontWeight: "800",
    lineHeight: 24,
  },
  subtitle: {
    marginTop: 2,
    color: colors.black,
    fontSize: fontSizes.bodyLarge,
    fontWeight: "700",
    lineHeight: 22,
  },
  distance: {
    marginTop: 1,
    color: colors.black,
    fontSize: fontSizes.small,
    fontWeight: "800",
    lineHeight: 16,
  },
  chevronBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  chevronIcon: {
    width: 28,
    height: 28,
    resizeMode: "contain",
    tintColor: colors.black,
    opacity: 0.82,
  },
});
