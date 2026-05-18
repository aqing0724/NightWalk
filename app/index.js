import { StyleSheet, View } from "react-native";

import BottomNavigation from "./components/BottomNavigation";

export default function Page() {
  return (
    <View style={styles.container}>
      <View style={styles.content} />
      <BottomNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
  },
});
