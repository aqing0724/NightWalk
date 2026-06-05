import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

import { colors, fontSizes } from "../constants/theme";

export default function VoteSuccessToast({ animationKey }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    if (!animationKey) {
      return undefined;
    }

    opacity.setValue(0);
    scale.setValue(0.8);
    translateY.setValue(12);

    const animation = Animated.parallel([
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.delay(700),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -8,
        duration: 1100,
        useNativeDriver: true,
      }),
    ]);

    animation.start();

    return () => {
      animation.stop();
    };
  }, [animationKey, opacity, scale, translateY]);

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <Animated.View
        accessibilityLiveRegion="polite"
        style={[
          styles.toast,
          {
            opacity,
            transform: [{ translateY }, { scale }],
          },
        ]}
      >
        <View style={styles.checkCircle}>
          <Text style={styles.checkMark}>✓</Text>
        </View>
        <Text style={styles.message}>投票成功</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: "42%",
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: "center",
  },
  toast: {
    minWidth: 142,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: colors.special,
    alignItems: "center",
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 5,
  },
  checkCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: {
    color: colors.special,
    fontSize: fontSizes.title,
    fontWeight: "900",
    lineHeight: 25,
  },
  message: {
    marginTop: 7,
    color: colors.white,
    fontSize: fontSizes.body,
    fontWeight: "900",
    lineHeight: 20,
  },
});
