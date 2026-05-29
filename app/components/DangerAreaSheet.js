import {
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { auth, db } from "../../firebase";
import { voteOnReport } from "../../services/reportVoting";

const redDangerIcon = require("../../assets/redDanger.png");
const faceIcon = require("../../assets/Face.png");
const theftIcon = require("../../assets/Theft.png");
const harassIcon = require("../../assets/Harass.png");
const trackIcon = require("../../assets/Track.png");
const thumbsUpIcon = require("../../assets/ThumbsUp.png");
const thumbsDownIcon = require("../../assets/ThumbsDown.png");
const mapPinIcon = require("../../assets/MapPin.png");

const typeLabels = {
  theft: "偷竊",
  harass: "騷擾",
  track: "跟蹤",
};

const typeIcons = {
  theft: theftIcon,
  harass: harassIcon,
  track: trackIcon,
};

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
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const credibleCount = report?.credibleCount ?? 0;
  const notCredibleCount = report?.notCredibleCount ?? 0;
  const voteCount = credibleCount + notCredibleCount;
  const locationText =
    report?.locationText || report?.selectedAddress || "危險回報位置";
  const typeList = report?.types?.length ? report.types : [];
  const warningIcon = report ? redDangerIcon : faceIcon;

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
      await voteOnReport(report.id, nextVote);
      setSelectedVote((currentVote) =>
        currentVote === nextVote ? null : nextVote
      );
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
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityLabel="Close danger area details"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.backdrop}
        />

        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
          onLayout={(event) => {
            onSheetLayout?.(event.nativeEvent.layout.height);
          }}
        >
          <View style={styles.handle} />

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
                  <Image
                    source={typeIcons[type] || faceIcon}
                    style={styles.typeIcon}
                  />
                  <Text style={styles.typeText}>{typeLabels[type] || type}</Text>
                </View>
              ))
            ) : (
              <View style={styles.typeBadge}>
                <Image source={faceIcon} style={styles.typeIcon} />
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
                source={thumbsUpIcon}
                style={[
                  styles.voteIcon,
                  selectedVote === "credible" ? styles.voteIconActive : null,
                ]}
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
                source={thumbsDownIcon}
                style={[
                  styles.voteIcon,
                  selectedVote === "notCredible" ? styles.voteIconActive : null,
                ]}
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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  sheet: {
    width: "100%",
    paddingTop: 6,
    paddingHorizontal: 20,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: "#F7F7F7",
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#BFBFBF",
  },
  header: {
    marginTop: 24,
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
    color: "#000000",
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28,
  },

  metaItem: {
    marginRight: 22,
    flexDirection: "row",
    alignItems: "center",
  },
  metaText: {
    flex: 1,
    marginLeft: 9,
    color: "#111111",
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 20,
    marginBottom: 18,
    backgroundColor: "#D8D8D8",
  },
  sectionTitle: {
    color: "#000000",
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 24,
  },
  typeBadge: {
    alignSelf: "flex-start",
    height: 36,
    marginRight: 10,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
  },
  typeText: {
    marginLeft: 8,
    color: "#000000",
    fontSize: 15,
    fontWeight: "900",
  },
  typeRow: {
    marginTop: 10,
    marginBottom: -8,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  description: {
    marginTop: 12,
    color: "#111111",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  voteHint: {
    marginLeft: 2,
    marginBottom: 3,
    color: "#B5B5B5",
    fontSize: 10,
    fontWeight: "800",
  },
  voteRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  voteButton: {
    width: "47%",
    height: 31,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  voteButtonActive: {
    backgroundColor: "#AFC2B5",
  },
  voteText: {
    marginLeft: 10,
    color: "#000000",
    fontSize: 16,
    fontWeight: "900",
  },
  voteTextActive: {
    color: "#FFFFFF",
  },
  voteIconActive: {
    tintColor: "#FFFFFF",
  },
  metaIcon: {
    width: 22,
    height: 22,
    resizeMode: "contain",
  },
  typeIcon: {
    width: 20,
    height: 20,
    resizeMode: "contain",
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
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  fullEventText: {
    color: "#AFC2B5",
    fontSize: 15,
    fontWeight: "900",
  },
});
