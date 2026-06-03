import { Stack, usePathname } from "expo-router";
import { StatusBar, StyleSheet, View } from "react-native";
import {
  SafeAreaProvider,
  initialWindowMetrics,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import BottomNavigation from "./components/BottomNavigation";
import { colors } from "./constants/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AppFrame />
    </SafeAreaProvider>
  );
}

function AppFrame() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const showNavigation =
    pathname === "/" ||
    pathname === "/Add" ||
    pathname === "/Account" ||
    pathname === "/Login";

  return (
    <>
      <StatusBar
        translucent
        barStyle="light-content"
        backgroundColor={colors.transparent}
      />
      <View style={styles.screen}>
        <Stack screenOptions={{ headerShown: false, animation: "none" }} />
      </View>

      {showNavigation ? (
        <View
          style={[
            styles.navigation,
            { paddingBottom: Math.max(insets.bottom, 26) },
          ]}
        >
          <BottomNavigation />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  navigation: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.transparent,
    zIndex: 20,
    elevation: 20,
  },
});
