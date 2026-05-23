import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { auth, db } from "../firebase";
import { getCurrentVoterId, voteOnReport } from "../services/reportVoting";

const redDangerIcon = require("../assets/redDanger.png");
const mapPinIcon = require("../assets/MapPin.png");
const thumbsUpIcon = require("../assets/ThumbsUp.png");
const thumbsDownIcon = require("../assets/ThumbsDown.png");
const accountIcon = require("../assets/account_circle.png");
const sendIcon = require("../assets/Send-2.png");
const chevronIcon = require("../assets/Chevron right.png");

const typeLabels = {
  theft: "偷竊",
  harass: "騷擾",
  track: "跟蹤",
};

export default function DetailPage() {
  const router = useRouter();
  const { reportId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [report, setReport] = useState(null);
  const [comments, setComments] = useState([]);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [selectedVote, setSelectedVote] = useState(null);
  const currentReportId = Array.isArray(reportId) ? reportId[0] : reportId;

  useEffect(() => {
    setSelectedVote(null);
  }, [currentReportId]);

  useEffect(() => {
    if (!currentReportId) {
      setSelectedVote(null);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      doc(db, "reports", currentReportId, "votes", getCurrentVoterId()),
      (snapshot) => {
        setSelectedVote(snapshot.exists() ? snapshot.data().vote : null);
      }
    );

    return unsubscribe;
  }, [currentReportId]);

  useEffect(() => {
    if (!currentReportId) {
      setReport(null);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      doc(db, "reports", currentReportId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setReport(null);
          return;
        }

        setReport({
          id: snapshot.id,
          ...snapshot.data(),
        });
      },
      () => {
        Alert.alert("讀取失敗", "目前無法讀取回報內容，請稍後再試。");
      }
    );

    return unsubscribe;
  }, [currentReportId]);

  useEffect(() => {
    if (!currentReportId) {
      setComments([]);
      return undefined;
    }

    const commentsQuery = query(
      collection(db, "reports", currentReportId, "comments"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(
      commentsQuery,
      (snapshot) => {
        setComments(
          snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
        );
      },
      () => {
        Alert.alert("讀取失敗", "目前無法讀取留言，請稍後再試。");
      }
    );

    return unsubscribe;
  }, [currentReportId]);

  async function handleSendComment() {
    if (isSending) {
      return;
    }

    const nextMessage = message.trim();

    if (!currentReportId) {
      Alert.alert("無法留言", "缺少回報資料，請從回報列表重新進入。");
      return;
    }

    if (!nextMessage) {
      return;
    }

    setIsSending(true);

    try {
      const user = auth.currentUser;

      await addDoc(collection(db, "reports", currentReportId, "comments"), {
        message: nextMessage,
        userId: user?.uid ?? null,
        userName: user?.displayName ?? user?.email ?? "匿名使用者",
        createdAt: serverTimestamp(),
      });

      setMessage("");
    } catch (error) {
      Alert.alert("送出失敗", "目前無法送出留言，請稍後再試。");
    } finally {
      setIsSending(false);
    }
  }

  async function handleVote(nextVote) {
    if (!currentReportId || isVoting) {
      return;
    }

    setIsVoting(true);

    try {
      await voteOnReport(currentReportId, nextVote);
      setSelectedVote((currentVote) =>
        currentVote === nextVote ? null : nextVote
      );
    } catch (error) {
      if (error.message === "auth-required") {
        Alert.alert("需要登入", "請先登入後再進行社群驗證投票。");
        return;
      }

      Alert.alert("投票失敗", "目前無法送出投票，請稍後再試。");
    } finally {
      setIsVoting(false);
    }
  }

  const credibleCount = report?.credibleCount ?? 0;
  const notCredibleCount = report?.notCredibleCount ?? 0;
  const voteCount = credibleCount + notCredibleCount;
  const locationText =
    report?.locationText || report?.selectedAddress || "未提供位置描述";
  const typeList = report?.types?.length ? report.types : [];

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#F6F6F6" />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 18) }]}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backButton}
        >
          <Image source={chevronIcon} style={styles.backIcon} />
        </Pressable>

        <Text style={styles.headerTitle}>回報詳細頁</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 26) + 96 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.reportCard}>
          <View style={styles.reportHeader}>
            <Image source={redDangerIcon} style={styles.warningIcon} />

            <View style={styles.reportTitleGroup}>
              <Text style={styles.reportTitle}>
                {report?.dangerLevel || "危險回報"}
              </Text>
              <View style={styles.locationRow}>
                <Image source={mapPinIcon} style={styles.locationIcon} />
                <Text style={styles.locationText}>{locationText}</Text>
              </View>
            </View>
          </View>

          <View style={styles.tagRow}>
            {typeList.length ? (
              typeList.map((type) => (
                <View key={type} style={styles.tag}>
                  <Text style={styles.tagText}>{typeLabels[type] || type}</Text>
                </View>
              ))
            ) : (
              <View style={styles.tag}>
                <Text style={styles.tagText}>未分類</Text>
              </View>
            )}
          </View>

          <Text style={styles.description}>
            {report?.description || "尚未提供情況說明。"}
          </Text>
        </View>

        <View style={styles.voteCard}>
          <View style={styles.voteTitleRow}>
            <Text style={styles.sectionTitle}>社群驗證</Text>
            <Text style={styles.voteHint}>(已有 {voteCount} 人投票)</Text>
          </View>

          <View style={styles.voteRow}>
            <Pressable
              accessibilityLabel="Mark report as credible"
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
              accessibilityLabel="Mark report as not credible"
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
        </View>

        <Text style={styles.commentTitle}>留言與評論</Text>

        <View style={styles.commentList}>
          {comments.map((comment) => (
            <View key={comment.id} style={styles.commentCard}>
              <View style={styles.commentHeader}>
                <Image source={accountIcon} style={styles.avatarIcon} />
                <Text style={styles.commentName}>
                  {comment.userName || "匿名使用者"}
                </Text>
              </View>
              <Text style={styles.commentMessage}>{comment.message}</Text>
            </View>
          ))}
        </View>

      </ScrollView>

      <View
        style={[
          styles.inputBar,
          { paddingBottom: Math.max(insets.bottom, 26) },
        ]}
      >
        <View style={styles.inputCard}>
          <Image source={accountIcon} style={styles.inputAvatarIcon} />
          <TextInput
            accessibilityLabel="Write a comment"
            placeholder="發表你的評論..."
            placeholderTextColor="#9A9A9A"
            style={styles.commentInput}
            value={message}
            onChangeText={setMessage}
          />
          <Pressable
            accessibilityLabel="Send comment"
            accessibilityRole="button"
            hitSlop={10}
            disabled={isSending}
            onPress={handleSendComment}
            style={[
              styles.sendButton,
              isSending ? styles.sendButtonDisabled : null,
            ]}
          >
            <Image source={sendIcon} style={styles.sendIcon} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F6F6F6",
  },
  header: {
    height: 108,
    paddingHorizontal: 20,
    backgroundColor: "#F6F6F6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 34,
    height: 34,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  backIcon: {
    width: 28,
    height: 28,
    resizeMode: "contain",
    transform: [{ rotate: "180deg" }],
  },
  headerTitle: {
    color: "#000000",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 31,
  },
  headerSpacer: {
    width: 34,
  },
  content: {
    paddingHorizontal: 20,
  },
  reportCard: {
    minHeight: 244,
    paddingTop: 24,
    paddingHorizontal: 17,
    paddingBottom: 22,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
  },
  reportHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  warningIcon: {
    width: 35,
    height: 35,
    marginTop: 2,
    resizeMode: "contain",
  },
  reportTitleGroup: {
    flex: 1,
    marginLeft: 17,
  },
  reportTitle: {
    color: "#000000",
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 22,
  },
  locationRow: {
    marginTop: 7,
    flexDirection: "row",
    alignItems: "center",
  },
  locationIcon: {
    width: 17,
    height: 17,
    resizeMode: "contain",
  },
  locationText: {
    flex: 1,
    marginLeft: 6,
    color: "#7B7B7B",
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 19,
  },
  tagRow: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
  },
  tag: {
    minWidth: 63,
    height: 24,
    marginRight: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#F4F4F4",
    alignItems: "center",
    justifyContent: "center",
  },
  tagText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 17,
  },
  description: {
    marginTop: 16,
    color: "#000000",
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 25,
  },
  voteCard: {
    minHeight: 87,
    marginTop: 11,
    paddingTop: 13,
    paddingHorizontal: 6,
    paddingBottom: 10,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
  },
  voteTitleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  sectionTitle: {
    color: "#000000",
    fontSize: 19,
    fontWeight: "900",
    lineHeight: 25,
  },
  voteHint: {
    marginLeft: 1,
    marginBottom: 3,
    color: "#B9B9B9",
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 13,
  },
  voteRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  voteButton: {
    width: "48%",
    height: 30,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  voteButtonActive: {
    backgroundColor: "#AFC2B5",
  },
  voteIcon: {
    width: 22,
    height: 22,
    resizeMode: "contain",
  },
  voteIconActive: {
    tintColor: "#FFFFFF",
  },
  voteText: {
    marginLeft: 9,
    color: "#000000",
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 21,
  },
  voteTextActive: {
    color: "#FFFFFF",
  },
  commentTitle: {
    marginTop: 28,
    marginLeft: 4,
    color: "#000000",
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 26,
  },
  commentList: {
    marginTop: 12,
  },
  commentCard: {
    minHeight: 74,
    marginBottom: 10,
    paddingTop: 12,
    paddingHorizontal: 25,
    paddingBottom: 12,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarIcon: {
    width: 25,
    height: 25,
    resizeMode: "contain",
  },
  commentName: {
    marginLeft: 7,
    color: "#000000",
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 18,
  },
  commentMessage: {
    marginTop: 7,
    marginLeft: 32,
    color: "#000000",
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 19,
  },
  inputBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 8,
    paddingHorizontal: 20,
    backgroundColor: "#F6F6F6",
  },
  inputCard: {
    height: 57,
    paddingHorizontal: 25,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
  },
  inputAvatarIcon: {
    width: 26,
    height: 26,
    resizeMode: "contain",
    tintColor: "#8E8E8E",
  },
  commentInput: {
    flex: 1,
    height: "100%",
    marginLeft: 10,
    color: "#000000",
    fontSize: 14,
    fontWeight: "800",
  },
  sendButton: {
    width: 28,
    height: 28,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendIcon: {
    width: 21,
    height: 21,
    resizeMode: "contain",
  },
});
