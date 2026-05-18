import { Image, Pressable, StyleSheet, View } from "react-native";

const homeIcon = require("../../assets/Home.png");
const userIcon = require("../../assets/User.png");

export default function BottomNavigation() {
  return (
    <View style={styles.navWrap}>
      <View style={styles.navBar}>
        <Pressable
          accessibilityLabel="Home"
          accessibilityRole="button"
          style={styles.navItem}
        >
          <Image source={homeIcon} style={styles.navIcon} />
        </Pressable>

        <View style={styles.centerSlot} />

        <Pressable
          accessibilityLabel="Profile"
          accessibilityRole="button"
          style={styles.navItem}
        >
          <Image source={userIcon} style={styles.navIcon} />
        </Pressable>
      </View>

      <Pressable
        accessibilityLabel="Add"
        accessibilityRole="button"
        style={styles.addButton}
      >
        <View style={styles.addVertical} />
        <View style={styles.addHorizontal} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  navWrap: {
    position: "relative",
    alignItems: "center",
  },
  navBar: {
    width: "100%",
    height: 75,
    paddingHorizontal: 52,
    paddingTop: 20,
    backgroundColor: "#3b3b3b",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  navItem: {
    width: 66,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  centerSlot: {
    width: 66,
  },
  navIcon: {
    width: 30,
    height: 30,
    resizeMode: "contain",
  },
  addButton: {
    position: "absolute",
    top: -20,
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#9cad9f",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
    elevation: 8,
  },
  addVertical: {
    position: "absolute",
    width: 4,
    height: 36,
    borderRadius: 2,
    backgroundColor: "#ffffff",
  },
  addHorizontal: {
    position: "absolute",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ffffff",
  },
});
