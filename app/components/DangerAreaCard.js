import { Image, Pressable, StyleSheet, Text, View } from "react-native";

const redDangerIcon = require("../../assets/redDanger.png");
const pointRightIcon = require("../../assets/PointRight.png");

export default function DangerAreaCard({ onPress }) {
  return (
    <Pressable
      accessibilityLabel="Danger area nearby"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed ? styles.cardPressed : null,
      ]}
    >
      <Image source={redDangerIcon} style={styles.warningIcon} />

      <View style={styles.copy}>
        <Text style={styles.title}>危險區域</Text>
        <Text style={styles.subtitle}>近捷運科技大樓站</Text>
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
  chevronIcon: {
    width: 32,
    height: 32,
    resizeMode: "contain",
  },
});
