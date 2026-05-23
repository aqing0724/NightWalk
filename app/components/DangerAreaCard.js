import { Image, Pressable, StyleSheet, Text, View } from "react-native";

const yellowDangerIcon = require("../../assets/yellowDanger.png");
const orangeDangerIcon = require("../../assets/orangeDanger.png");
const redDangerIcon = require("../../assets/redDanger.png");
const faceIcon = require("../../assets/Face.png");
const pointRightIcon = require("../../assets/PointRight.png");

const dangerLevelIcons = {
  "需要注意": yellowDangerIcon,
  "有點危險": orangeDangerIcon,
  "極度危險": redDangerIcon,
};

const dangerLevelTitles = {
  "需要注意": "需要注意區域",
  "有點危險": "有點危險區域",
  "極度危險": "極度危險區域",

};

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
  const warningIcon = report
    ? dangerLevelIcons[report.dangerLevel] || redDangerIcon
    : faceIcon;
  const title = report
    ? dangerLevelTitles[report.dangerLevel] || "危險區域"
    : "安全區域";

  return (
    <Pressable
      accessibilityLabel="Danger area nearby"
      accessibilityRole="button"
      disabled={!report}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed ? styles.cardPressed : null,
      ]}
    >
      <Image source={warningIcon} style={styles.warningIcon} />

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

      <Image source={pointRightIcon} style={styles.chevronIcon} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 75,
    marginHorizontal: 0,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
  },
  warningIcon: {
    width: 48,
    height: 48,
    resizeMode: "contain",
  },
  copy: {
    flex: 1,
    marginLeft: 18,
    justifyContent: "center",
  },
  title: {
    color: "#000000",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
  },
  subtitle: {
    marginTop: 2,
    color: "#000000",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  distance: {
    marginTop: 1,
    color: "#777777",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16,
  },
  chevronIcon: {
    width: 32,
    height: 32,
    resizeMode: "contain",
  },
});
