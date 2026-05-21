import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const redDangerIcon = require("../../assets/redDanger.png");
const faceIcon = require("../../assets/Face.png");
const thumbsUpIcon = require("../../assets/ThumbsUp.png");
const thumbsDownIcon = require("../../assets/ThumbsDown.png");
const mapPinIcon = require("../../assets/MapPin.png");
const clockIcon = require("../../assets/Clock.png");

export default function DangerAreaSheet({ visible, onClose }) {
  const insets = useSafeAreaInsets();

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
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            <Image source={redDangerIcon} style={styles.warningIcon} />
            <Text style={styles.title}>高危險區域</Text>
          </View>

          
            <View style={styles.metaItem}>
              <Image source={mapPinIcon} style={styles.metaIcon} />
              <Text style={styles.metaText}>近捷運科技大樓站</Text>
            </View>
          

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>危險類型</Text>
          <View style={styles.typeBadge}>
            <Image source={faceIcon} style={styles.typeIcon} />
            <Text style={styles.typeText}>偷竊</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>社群驗證</Text>
            <Text style={styles.voteHint}>已有 50 人投票</Text>
          </View>

          <View style={styles.voteRow}>
            <Pressable
              accessibilityLabel="Trust this danger report"
              accessibilityRole="button"
              style={[styles.voteButton, styles.voteButtonActive]}
            >
              <Image source={thumbsUpIcon} style={styles.voteIcon} />
              <Text style={[styles.voteText, styles.voteTextActive]}>可信(40)</Text>
            </Pressable>

            <Pressable
              accessibilityLabel="Distrust this danger report"
              accessibilityRole="button"
              style={styles.voteButton}
            >
              <Image source={thumbsDownIcon} style={styles.voteIcon} />
              <Text style={styles.voteText}>不可信(10)</Text>
            </Pressable>
          </View>

          <View style={styles.divider} />

          <Pressable
            accessibilityLabel="View full incident"
            accessibilityRole="button"
            style={styles.fullEventButton}
          >
            <Text style={styles.fullEventText}>查看完整事件</Text>
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
    height: 34,
    marginTop: 10,
    paddingHorizontal: 11,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
  },
  typeText: {
    marginLeft: 10,
    color: "#000000",
    fontSize: 15,
    fontWeight: "900",
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
    backgroundColor: "#FFFFFF",
  },
  voteText: {
    marginLeft: 10,
    color: "#000000",
    fontSize: 16,
    fontWeight: "900",
  },
  voteTextActive: {
    color: "#000000",
  },
  metaIcon: {
    width: 22,
    height: 22,
    resizeMode: "contain",
  },
  typeIcon: {
    width: 22,
    height: 22,
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
