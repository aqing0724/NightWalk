import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { auth, db } from "../../firebase";
import { colors, fontSizes } from "../constants/theme";
import { voteOnReport } from "../../services/reportVoting";
import VoteSuccessToast from "./VoteSuccessToast";

const redDangerIcon = require("../../assets/redDanger.png");
const faceIcon = require("../../assets/Face.png");
const thumbsUpIcon = require("../../assets/ThumbsUp.png");
const thumbsUpActiveIcon = require("../../assets/ThumbUp-on.png");
const thumbsDownIcon = require("../../assets/ThumbsDown.png");
const thumbsDownActiveIcon = require("../../assets/ThumbsDown-on.png");
const mapPinIcon = require("../../assets/MapPin.png");

const typeLabels = {
  theft: "偷竊",
  harass: "騷擾",
  track: "跟蹤",
};
const customTypePrefix = "custom:";

function formatTypeLabel(type) {
  if (typeof type === "string" && type.startsWith(customTypePrefix)) {
    return type.replace(customTypePrefix, "");
  }

  return typeLabels[type] || type;
}

const dismissDistance = Dimensions.get("window").height;
const minimumVisibleHeight = 96;
const dismissVelocity = 1.4;
const sheetOpenDuration = 260;
const sheetCloseDuration = 220;

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

export default function DangerAreaSheet({
  visible,
  report,
  onClose,
  onSheetLayout,
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isVoting, setIsVoting] = useState(false);
  const [selectedVote, setSelectedVote] = useState(null);
  const [voteSuccessAnimationKey, setVoteSuccessAnimationKey] = useState(0);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const dragY = useRef(new Animated.Value(dismissDistance)).current;
  const dragOffsetRef = useRef(0);
  const dragStartOffsetRef = useRef(0);
  const onCloseRef = useRef(onClose);
  const onSheetLayoutRef = useRef(onSheetLayout);
  const sheetHeightRef = useRef(0);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 6 &&
        Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onMoveShouldSetPanResponderCapture: (_, gestureState) =>
        Math.abs(gestureState.dy) > 6 &&
        Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderGrant: () => {
        dragStartOffsetRef.current = dragOffsetRef.current;
      },
      onPanResponderMove: (_, gestureState) => {
        const nextOffset = clamp(
          dragStartOffsetRef.current + gestureState.dy,
          0,
          sheetHeightRef.current || dismissDistance
        );

        dragOffsetRef.current = nextOffset;
        dragY.setValue(nextOffset);
      },
      onPanResponderRelease: (_, gestureState) => {
        const sheetHeight = sheetHeightRef.current || dismissDistance;
        const nextOffset = clamp(
          dragStartOffsetRef.current + gestureState.dy,
          0,
          sheetHeight
        );
        const shouldClose =
          nextOffset > sheetHeight - minimumVisibleHeight ||
          (gestureState.vy > dismissVelocity && nextOffset > 120);

        if (shouldClose) {
          Animated.timing(dragY, {
            toValue: dismissDistance,
            duration: sheetCloseDuration,
            useNativeDriver: true,
          }).start(() => {
            onCloseRef.current?.();
          });
          return;
        }

        dragOffsetRef.current = nextOffset;
        dragY.setValue(nextOffset);
        onSheetLayoutRef.current?.(sheetHeight - nextOffset);
      },
      onPanResponderTerminate: () => {
        onSheetLayoutRef.current?.(
          sheetHeightRef.current - dragOffsetRef.current
        );
      },
      onShouldBlockNativeResponder: () => true,
    })
  ).current;
  const credibleCount = report?.credibleCount ?? 0;
  const notCredibleCount = report?.notCredibleCount ?? 0;
  const voteCount = credibleCount + notCredibleCount;
  const locationText =
    report?.locationText || report?.selectedAddress || "危險回報位置";
  const typeList = report?.types?.length ? report.types : [];
  const warningIcon = report ? redDangerIcon : faceIcon;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    onSheetLayoutRef.current = onSheetLayout;
  }, [onSheetLayout]);

  useEffect(() => {
    if (visible) {
      dragOffsetRef.current = 0;
      dragY.setValue(dismissDistance);
      Animated.timing(dragY, {
        toValue: 0,
        duration: sheetOpenDuration,
        useNativeDriver: true,
      }).start();
      return;
    }

    dragOffsetRef.current = 0;
    dragY.setValue(dismissDistance);
  }, [dragY, visible]);

  useEffect(() => {
    setSelectedVote(null);
  }, [report?.id]);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);

      if (!user) {
        setSelectedVote(null);
      }
    });
  }, []);

  useEffect(() => {
    if (!report?.id || !currentUser) {
      setSelectedVote(null);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      doc(db, "reports", report.id, "votes", currentUser.uid),
      (snapshot) => {
        setSelectedVote(snapshot.exists() ? snapshot.data().vote : null);
      }
    );

    return unsubscribe;
  }, [report?.id, currentUser]);

  function handleViewFullEvent() {
    if (!report?.id) {
      return;
    }

    onClose?.();
    requestAnimationFrame(() => {
      router.push({
        pathname: "/detail",
        params: { reportId: report.id },
      });
    });
  }

  async function handleVote(nextVote) {
    if (!report?.id || isVoting) {
      return;
    }

    if (!auth.currentUser) {
      showLoginRequiredAlert();
      return;
    }

    setIsVoting(true);

    try {
      const isNewVote = selectedVote !== nextVote;

      await voteOnReport(report.id, nextVote);
      setSelectedVote((currentVote) =>
        currentVote === nextVote ? null : nextVote
      );

      if (isNewVote) {
        setVoteSuccessAnimationKey((currentKey) => currentKey + 1);
      }
    } catch (error) {
      if (error.message === "auth-required") {
        showLoginRequiredAlert();
        return;
      }

      Alert.alert("投票失敗", "目前無法送出投票，請稍後再試。");
    } finally {
      setIsVoting(false);
    }
  }

  function showLoginRequiredAlert() {
    Alert.alert("請先登入", "登入後才能進行社群驗證投票。", [
      { text: "取消", style: "cancel" },
      {
        text: "前往登入",
        onPress: () => {
          onClose?.();
          requestAnimationFrame(() => {
            router.push("/Login");
          });
        },
      },
    ]);
  }

  return (
    <Modal
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="Close danger area details"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.backdrop}
        />

        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 16),
              transform: [{ translateY: dragY }],
            },
          ]}
          onLayout={(event) => {
            const nextSheetHeight = event.nativeEvent.layout.height;

            sheetHeightRef.current = nextSheetHeight;
            onSheetLayout?.(nextSheetHeight - dragOffsetRef.current);
          }}
        >
        <View
          accessibilityLabel="Drag to resize danger area details"
          accessibilityRole="adjustable"
          {...panResponder.panHandlers}
          style={styles.handleArea}
        >
          <View style={styles.handle} />
        </View>

        <View style={styles.header}>
          <Image source={warningIcon} style={styles.warningIcon} />
          <Text style={styles.title}>危險區域</Text>
        </View>

        <View style={styles.metaItem}>
          <Image source={mapPinIcon} style={styles.metaIcon} />
          <Text style={styles.metaText}>{locationText}</Text>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>危險類型</Text>
        <View style={styles.typeRow}>
          {typeList.length ? (
            typeList.map((type) => (
              <View key={type} style={styles.typeBadge}>
                <Text style={styles.typeHash}>#</Text>
                <Text style={styles.typeText}>{formatTypeLabel(type)}</Text>
              </View>
            ))
          ) : (
            <View style={styles.typeBadge}>
              <Text style={styles.typeHash}>#</Text>
              <Text style={styles.typeText}>未分類</Text>
            </View>
          )}
        </View>

        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>危險描述</Text>

        {report?.description ? (
          <Text style={styles.description} numberOfLines={3}>
            {report.description}
          </Text>
        ) : null}

        <View style={styles.divider} />

        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>社群驗證</Text>
          <Text style={styles.voteHint}>已有 {voteCount} 人投票</Text>
        </View>

        <View style={styles.voteRow}>
          <Pressable
            accessibilityLabel="Trust this danger report"
            accessibilityRole="button"
            disabled={isVoting}
            onPress={() => handleVote("credible")}
            style={[
              styles.voteButton,
              selectedVote === "credible" ? styles.voteButtonActive : null,
            ]}
          >
            <Image
              source={
                selectedVote === "credible" ? thumbsUpActiveIcon : thumbsUpIcon
              }
              style={styles.voteIcon}
            />
            <Text
              style={[
                styles.voteText,
                selectedVote === "credible" ? styles.voteTextActive : null,
              ]}
            >
              可信({credibleCount})
            </Text>
          </Pressable>

          <Pressable
            accessibilityLabel="Distrust this danger report"
            accessibilityRole="button"
            disabled={isVoting}
            onPress={() => handleVote("notCredible")}
            style={[
              styles.voteButton,
              selectedVote === "notCredible" ? styles.voteButtonActive : null,
            ]}
          >
            <Image
              source={
                selectedVote === "notCredible"
                  ? thumbsDownActiveIcon
                  : thumbsDownIcon
              }
              style={styles.voteIcon}
            />
            <Text
              style={[
                styles.voteText,
                selectedVote === "notCredible" ? styles.voteTextActive : null,
              ]}
            >
              不可信({notCredibleCount})
            </Text>
          </Pressable>
        </View>

        <View style={styles.divider} />

        <Pressable
          accessibilityLabel="View full incident"
          accessibilityRole="button"
          disabled={!report?.id}
          onPress={handleViewFullEvent}
          style={styles.fullEventButton}
        >
          <Text style={styles.fullEventText}>點擊查看完整事件</Text>
        </Pressable>
      </Animated.View>

      <VoteSuccessToast animationKey={voteSuccessAnimationKey} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.transparent,
  },
  sheet: {
    width: "100%",
    paddingTop: 6,
    paddingHorizontal: 20,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden",
    backgroundColor: colors.white,
  },
  handleArea: {
    height: 44,
    paddingTop: 5,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  handle: {
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.handle,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
  },
  warningIcon: {
    width: 46,
    height: 46,
    resizeMode: "contain",
  },
  title: {
    marginLeft: 12,
    color: colors.black,
    fontSize: fontSizes.heading,
    fontWeight: "900",
    lineHeight: 30,
  },

  metaItem: {
    marginTop: 12,
    marginRight: 22,
    flexDirection: "row",
    alignItems: "center",
  },
  metaText: {
    flex: 1,
    marginLeft: 9,
    color: colors.black,
    fontSize: fontSizes.bodySmall,
    fontWeight: "700",
    lineHeight: 20,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 18,
    marginBottom: 16,
    backgroundColor: colors.divider,
  },
  sectionTitle: {
    color: colors.black,
    fontSize: fontSizes.subtitle,
    fontWeight: "900",
    lineHeight: 23,
  },
  typeBadge: {
    alignSelf: "flex-start",
    height: 38,
    marginRight: 10,
    marginBottom: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    flexDirection: "row",
    alignItems: "center",
  },
  typeText: {
    marginLeft: 6,
    color: colors.black,
    fontSize: fontSizes.bodyLarge,
    fontWeight: "800",
    lineHeight: 22,
  },
  typeHash: {
    color: colors.black,
    fontSize: fontSizes.bodyLarge,
    fontWeight: "900",
    lineHeight: 22,
  },
  typeRow: {
    marginTop: 10,
    marginBottom: -8,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  description: {
    marginTop: 10,
    color: colors.black,
    fontSize: fontSizes.bodySmall,
    fontWeight: "600",
    lineHeight: 20,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  voteHint: {
    marginLeft: 8,
    color: colors.black,
    fontSize: fontSizes.footnote,
    fontWeight: "700",
    lineHeight: 15,
  },
  voteRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  voteButton: {
    width: "47%",
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  voteButtonActive: {
    backgroundColor: colors.special,
  },
  voteText: {
    marginLeft: 8,
    color: colors.black,
    fontSize: fontSizes.bodySmall,
    fontWeight: "800",
    lineHeight: 18,
  },
  voteTextActive: {
    color: colors.white,
  },
  metaIcon: {
    width: 22,
    height: 22,
    resizeMode: "contain",
    tintColor: colors.black,
    opacity: 1,
  },
  voteIcon: {
    width: 21,
    height: 21,
    resizeMode: "contain",
  },
  fullEventButton: {
    height: 40,
    marginTop: 16,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  fullEventText: {
    color: colors.special,
    fontSize: fontSizes.body,
    fontWeight: "900",
    lineHeight: 20,
  },
});
