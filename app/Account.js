import { useEffect, useState } from "react";
import { StatusBar, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../firebase";
import { colors, fontSizes } from "./constants/theme";

export default function AccountPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthChecked(true);

      if (!user) {
        router.replace("/Login");
      }
    });
  }, [router]);

  if (!authChecked || !currentUser) {
    return <View style={styles.screen} />;
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      <Text style={styles.title}>成功登入</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: colors.black,
    fontSize: fontSizes.heading,
    fontWeight: "900",
    lineHeight: 31,
  },
});
