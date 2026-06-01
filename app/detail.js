import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
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
import { onAuthStateChanged } from "firebase/auth";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { auth, db } from "../firebase";
import { colors, fontSizes } from "./constants/theme";
import { voteOnReport } from "../services/reportVoting";
import VoteSuccessToast from "./components/VoteSuccessToast";

const redDangerIcon = require("../assets/redDanger.png");
const mapPinIcon = require("../assets/MapPin.png");
const thumbsUpIcon = require("../assets/ThumbsUp.png");
const thumbsUpActiveIcon = require("../assets/ThumbUp-on.png");
const thumbsDownIcon = require("../assets/ThumbsDown.png");
const thumbsDownActiveIcon = require("../assets/ThumbsDown-on.png");
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
  const [voteSuccessAnimationKey, setVoteSuccessAnimationKey] = useState(0);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const currentReportId = Array.isArray(reportId) ? reportId[0] : reportId;

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);

      if (!user) {
        setSelectedVote(null);
      }
    });
  }, []);

  useEffect(() => {
    setSelectedVote(null);
  }, [currentReportId]);

  useEffect(() => {
    if (!currentReportId || !currentUser) {
      setSelectedVote(null);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      doc(db, "reports", currentReportId, "votes", currentUser.uid),
      (snapshot) => {
        setSelectedVote(snapshot.exists() ? snapshot.data().vote : null);
      }
    );

    return unsubscribe;
  }, [currentReportId, currentUser]);

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
    const user = auth.currentUser;

    if (!currentReportId) {
      Alert.alert("無法留言", "缺少回報資料，請從回報列表重新進入。");
      return;
    }

    if (!user) {
      showLoginRequiredAlert("登入後才能發表評論。");
      return;
    }

    if (!nextMessage) {
      return;
    }

    setIsSending(true);

    try {
      await addDoc(collection(db, "reports", currentReportId, "comments"), {
        message: nextMessage,
        userId: user.uid,
        userName: user.displayName || "NightWalk 使用者",
        createdAt: serverTimestamp(),
      });

      setMessage("");
    } catch {
      Alert.alert("送出失敗", "目前無法送出留言，請稍後再試。");
    } finally {
      setIsSending(false);
    }
  }

  async function handleVote(nextVote) {
    if (!currentReportId || isVoting) {
      return;
    }

    if (!auth.currentUser) {
      showLoginRequiredAlert("登入後才能進行社群驗證投票。");
      return;
    }

    setIsVoting(true);

    try {
      const isNewVote = selectedVote !== nextVote;

      await voteOnReport(currentReportId, nextVote);
      setSelectedVote((currentVote) =>
        currentVote === nextVote ? null : nextVote
      );

      if (isNewVote) {
        setVoteSuccessAnimationKey((currentKey) => currentKey + 1);
      }
    } catch (error) {
      if (error.message === "auth-required") {
        showLoginRequiredAlert("登入後才能進行社群驗證投票。");
        return;
      }

      Alert.alert("投票失敗", "目前無法送出投票，請稍後再試。");
    } finally {
      setIsVoting(false);
    }
  }

  function showLoginRequiredAlert(message) {
    Alert.alert("請先登入", message, [
      { text: "取消", style: "cancel" },
      { text: "前往登入", onPress: () => router.push("/Login") },
    ]);
  }

  const credibleCount = report?.credibleCount ?? 0;
  const notCredibleCount = report?.notCredibleCount ?? 0;
  const voteCount = credibleCount + notCredibleCount;
  const locationText =
    report?.locationText || report?.selectedAddress || "未提供位置描述";
  const typeList = report?.types?.length ? report.types : [];
  const imageUrls = report?.imageUrls?.length
    ? report.imageUrls
    : report?.imageUrl
      ? [report.imageUrl]
      : [];
  const warningIcon = redDangerIcon;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor={colors.background}
      />

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
          { paddingBottom: 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        <View style={styles.reportCard}>
          <View style={styles.reportHeader}>
            <Image source={warningIcon} style={styles.warningIcon} />

            <View style={styles.reportTitleGroup}>
              <Text style={styles.reportTitle}>危險回報</Text>
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

        {imageUrls.length ? (
          <ScrollView
            contentContainerStyle={styles.reportImageRow}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {imageUrls.map((imageUrl, index) => (
              <View key={`${imageUrl}-${index}`} style={styles.reportImageCard}>
                <Image
                  accessibilityLabel={`Report photo ${index + 1}`}
                  resizeMode="cover"
                  source={{ uri: imageUrl }}
                  style={styles.reportImage}
                />
              </View>
            ))}
          </ScrollView>
        ) : null}

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
                source={
                  selectedVote === "credible"
                    ? thumbsUpActiveIcon
                    : thumbsUpIcon
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
            editable={!isSending}
            maxLength={500}
            onChangeText={setMessage}
            onSubmitEditing={handleSendComment}
            placeholder={
              currentUser ? "發表你的評論..." : "登入後才能發表評論"
            }
            placeholderTextColor={colors.special}
            returnKeyType="send"
            style={styles.commentInput}
            value={message}
          />
          <Pressable
            accessibilityLabel="Send comment"
            accessibilityRole="button"
            disabled={isSending || !message.trim()}
            hitSlop={10}
            onPress={handleSendComment}
            style={[
              styles.sendButton,
              isSending || !message.trim()
                ? styles.sendButtonDisabled
                : null,
            ]}
          >
            <Image source={sendIcon} style={styles.sendIcon} />
          </Pressable>
        </View>
      </View>

      <VoteSuccessToast animationKey={voteSuccessAnimationKey} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    height: 108,
    paddingHorizontal: 20,
    backgroundColor: colors.background,
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
    color: colors.black,
    fontSize: fontSizes.bodyLarge,
    fontWeight: "900",
    lineHeight: 31,
  },
  headerSpacer: {
    width: 34,
  },
  content: {
    paddingHorizontal: 20,
  },
  scrollView: {
    flex: 1,
  },
  reportCard: {
    minHeight: 244,
    paddingTop: 24,
    paddingHorizontal: 17,
    paddingBottom: 22,
    borderRadius: 9,
    backgroundColor: colors.white,
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
    color: colors.black,
    fontSize: fontSizes.subtitle,
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
    color: colors.black,
    fontSize: fontSizes.bodySmall,
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
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  tagText: {
    color: colors.black,
    fontSize: fontSizes.labelSmall,
    fontWeight: "900",
    lineHeight: 17,
  },
  description: {
    marginTop: 16,
    color: colors.black,
    fontSize: fontSizes.bodySmall,
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
    backgroundColor: colors.white,
  },
  voteTitleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  sectionTitle: {
    color: colors.black,
    fontSize: fontSizes.titleMedium,
    fontWeight: "900",
    lineHeight: 25,
  },
  voteHint: {
    marginLeft: 1,
    marginBottom: 3,
    color: colors.special,
    fontSize: fontSizes.caption,
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
    backgroundColor: colors.background,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  voteButtonActive: {
    backgroundColor: colors.special,
  },
  voteIcon: {
    width: 22,
    height: 22,
    resizeMode: "contain",
  },
  voteText: {
    marginLeft: 9,
    color: colors.black,
    fontSize: fontSizes.bodyLarge,
    fontWeight: "900",
    lineHeight: 21,
  },
  voteTextActive: {
    color: colors.white,
  },
  reportImageRow: {
    paddingTop: 18,
    paddingRight: 8,
  },
  reportImageCard: {
    width: 300,
    height: 220,
    marginRight: 10,
    borderRadius: 9,
    backgroundColor: colors.white,
    overflow: "hidden",
  },
  reportImage: {
    width: "100%",
    height: "100%",
  },
  commentTitle: {
    marginTop: 28,
    marginLeft: 4,
    color: colors.black,
    fontSize: fontSizes.title,
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
    backgroundColor: colors.white,
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
    color: colors.black,
    fontSize: fontSizes.bodySmall,
    fontWeight: "900",
    lineHeight: 18,
  },
  commentMessage: {
    marginTop: 7,
    marginLeft: 32,
    color: colors.black,
    fontSize: fontSizes.bodySmall,
    fontWeight: "800",
    lineHeight: 19,
  },
  inputBar: {
    paddingTop: 8,
    paddingHorizontal: 20,
    backgroundColor: colors.background,
  },
  inputCard: {
    height: 57,
    paddingHorizontal: 25,
    borderRadius: 9,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
  },
  inputAvatarIcon: {
    width: 26,
    height: 26,
    resizeMode: "contain",
    tintColor: colors.special,
  },
  commentInput: {
    flex: 1,
    height: "100%",
    marginLeft: 10,
    color: colors.black,
    fontSize: fontSizes.bodySmall,
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
