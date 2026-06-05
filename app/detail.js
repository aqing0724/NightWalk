import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  Keyboard,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  deleteDoc,
  setDoc,
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
const customTypePrefix = "custom:";

function formatTypeLabel(type) {
  let label = typeLabels[type] || type || "未分類";

  if (typeof type === "string" && type.startsWith(customTypePrefix)) {
    label = type.replace(customTypePrefix, "") || "未分類";
  }

  return label;
}

function formatCommentDate(createdAt) {
  const date =
    typeof createdAt?.toDate === "function"
      ? createdAt.toDate()
      : createdAt instanceof Date
        ? createdAt
        : typeof createdAt === "number"
          ? new Date(createdAt)
          : null;

  if (!date || Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

function getCommentTime(createdAt) {
  const date =
    typeof createdAt?.toDate === "function"
      ? createdAt.toDate()
      : createdAt instanceof Date
        ? createdAt
        : typeof createdAt === "number"
          ? new Date(createdAt)
          : null;

  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

function sortComments(comments, currentUserId) {
  return [...comments].sort((firstComment, secondComment) => {
    const firstIsMine =
      currentUserId && firstComment.userId === currentUserId ? 1 : 0;
    const secondIsMine =
      currentUserId && secondComment.userId === currentUserId ? 1 : 0;

    if (firstIsMine !== secondIsMine) {
      return secondIsMine - firstIsMine;
    }

    return (
      getCommentTime(secondComment.createdAt) -
      getCommentTime(firstComment.createdAt)
    );
  });
}

function CommentSuccessBanner({ animationKey, bottomOffset }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(28)).current;
  const iconTranslateX = useRef(new Animated.Value(-8)).current;

  useEffect(() => {
    if (!animationKey) {
      return undefined;
    }

    opacity.setValue(0);
    translateY.setValue(28);
    iconTranslateX.setValue(-8);

    const animation = Animated.parallel([
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.delay(900),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 7,
        tension: 110,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(80),
        Animated.spring(iconTranslateX, {
          toValue: 0,
          friction: 5,
          tension: 130,
          useNativeDriver: true,
        }),
      ]),
    ]);

    animation.start();

    return () => {
      animation.stop();
    };
  }, [animationKey, iconTranslateX, opacity, translateY]);

  return (
    <View
      pointerEvents="none"
      style={[styles.commentSuccessOverlay, { bottom: bottomOffset }]}
    >
      <Animated.View
        accessibilityLiveRegion="polite"
        style={[
          styles.commentSuccessBanner,
          {
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.commentSuccessIconBubble,
            { transform: [{ translateX: iconTranslateX }] },
          ]}
        >
          <Image source={sendIcon} style={styles.commentSuccessIcon} />
        </Animated.View>
        <Text style={styles.commentSuccessText}>評論已送出</Text>
      </Animated.View>
    </View>
  );
}

export default function DetailPage() {
  const router = useRouter();
  const { reportId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef(null);
  const commentListYRef = useRef(0);
  const pendingCommentIdRef = useRef(null);
  const [report, setReport] = useState(null);
  const [comments, setComments] = useState([]);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedVote, setSelectedVote] = useState(null);
  const [voteSuccessAnimationKey, setVoteSuccessAnimationKey] = useState(0);
  const [commentSuccessAnimationKey, setCommentSuccessAnimationKey] =
    useState(0);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const currentReportId = Array.isArray(reportId) ? reportId[0] : reportId;
  const inputBottomPadding = Math.max(insets.bottom, 26);

  const scrollToComment = useCallback((commentY) => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: Math.max(commentY - 18, 0),
          animated: true,
        });
      }, 80);
    });
  }, []);

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
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      commentsQuery,
      (snapshot) => {
        const nextComments =
          snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

        setComments(sortComments(nextComments, currentUser?.uid));
      },
      () => {
        Alert.alert("讀取失敗", "目前無法讀取留言，請稍後再試。");
      }
    );

    return unsubscribe;
  }, [currentReportId, currentUser?.uid]);

  const handleRefresh = useCallback(async () => {
    if (!currentReportId) {
      return;
    }

    setIsRefreshing(true);

    try {
      const reportRef = doc(db, "reports", currentReportId);
      const commentsQuery = query(
        collection(db, "reports", currentReportId, "comments"),
        orderBy("createdAt", "desc")
      );

      const requests = [getDoc(reportRef), getDocs(commentsQuery)];

      if (currentUser) {
        requests.push(
          getDoc(doc(db, "reports", currentReportId, "votes", currentUser.uid))
        );
      }

      const [reportSnapshot, commentsSnapshot, voteSnapshot] =
        await Promise.all(requests);

      setReport(
        reportSnapshot.exists()
          ? {
              id: reportSnapshot.id,
              ...reportSnapshot.data(),
            }
          : null
      );
      const nextComments = commentsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setComments(sortComments(nextComments, currentUser?.uid));

      if (currentUser && voteSnapshot) {
        setSelectedVote(voteSnapshot.exists() ? voteSnapshot.data().vote : null);
      } else {
        setSelectedVote(null);
      }
    } catch {
      Alert.alert("刷新失敗", "目前無法更新回報內容，請稍後再試。");
    } finally {
      setIsRefreshing(false);
    }
  }, [currentReportId, currentUser]);

  async function handleSendComment() {
    if (isSending) {
      return;
    }

    const nextMessage = message.trim();
    const user = auth.currentUser;
    if (!report || !currentReportId) {
      Alert.alert("操作失敗", "該筆危險回報已被刪除，無法再發表評論。");
      return;
    }
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
      const nextCommentRef = doc(
        collection(db, "reports", currentReportId, "comments")
      );

      pendingCommentIdRef.current = nextCommentRef.id;

      await setDoc(nextCommentRef, {
        message: nextMessage,
        userId: user.uid,
        userName: user.displayName || "NightWalk 使用者",
        createdAt: serverTimestamp(),
        locationText: locationText,
      });

      setMessage("");
      setCommentSuccessAnimationKey((currentKey) => currentKey + 1);
    } catch {
      pendingCommentIdRef.current = null;
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
    <View style={styles.screen}>
      <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
        <View style={styles.screen}>
          <StatusBar
            barStyle="dark-content"
            backgroundColor={colors.background}
          />

          <View
            style={[styles.header, { paddingTop: Math.max(insets.top, 18) }]}
          >
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
            {currentUser && report?.userId === currentUser.uid ? (
              <Pressable
                accessibilityLabel="Delete report"
                accessibilityRole="button"
                hitSlop={12}
                onPress={handleDeleteReport}
                style={styles.deleteHeaderButton}
              >
                <Text style={styles.deleteHeaderText}>刪</Text>
              </Pressable>
            ) : (
              <View style={styles.headerSpacer} />
            )}
          </View>

          <ScrollView
            ref={scrollViewRef}
            alwaysBounceVertical
            contentContainerStyle={[
              styles.content,
              { paddingBottom: inputBottomPadding + 106 },
            ]}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={colors.special}
                colors={[colors.special]}
                progressBackgroundColor={colors.white}
              />
            }
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
                      <Text style={styles.tagHash}>#</Text>
                      <Text style={styles.tagText}>
                        {formatTypeLabel(type)}
                      </Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.tag}>
                    <Text style={styles.tagHash}>#</Text>
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
                  <View
                    key={`${imageUrl}-${index}`}
                    style={styles.reportImageCard}
                  >
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
                    selectedVote === "credible"
                      ? styles.voteButtonActive
                      : null,
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
                      selectedVote === "credible"
                        ? styles.voteTextActive
                        : null,
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
                    selectedVote === "notCredible"
                      ? styles.voteButtonActive
                      : null,
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
                      selectedVote === "notCredible"
                        ? styles.voteTextActive
                        : null,
                    ]}
                  >
                    不可信({notCredibleCount})
                  </Text>
                </Pressable>
              </View>
            </View>

            <Text style={styles.commentTitle}>
              留言與評論
            </Text>

            <View
              onLayout={(event) => {
                commentListYRef.current = event.nativeEvent.layout.y;
              }}
              style={styles.commentList}
            >
              {comments.map((comment) => (
                <View
                  key={comment.id}
                  onLayout={(event) => {
                    if (pendingCommentIdRef.current !== comment.id) {
                      return;
                    }

                    pendingCommentIdRef.current = null;
                    scrollToComment(
                      commentListYRef.current + event.nativeEvent.layout.y
                    );
                  }}
                  style={styles.commentCard}
                >
                  <View style={styles.commentHeader}>
                    <Image source={accountIcon} style={styles.avatarIcon} />
                    <Text style={styles.commentName}>
                      {comment.userName || "匿名使用者"}
                    </Text>
                    {formatCommentDate(comment.createdAt) ? (
                      <Text style={styles.commentDate}>
                        {formatCommentDate(comment.createdAt)}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.commentMessage}>{comment.message}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          <KeyboardStickyView
            offset={{ closed: 0, opened: inputBottomPadding }}
            style={[
              styles.inputBar,
              { paddingBottom: inputBottomPadding },
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
          </KeyboardStickyView>

          <VoteSuccessToast animationKey={voteSuccessAnimationKey} />
          <CommentSuccessBanner
            animationKey={commentSuccessAnimationKey}
            bottomOffset={inputBottomPadding + 78}
          />
        </View>
      </TouchableWithoutFeedback>
    </View>
  );

// 🎯 2. 新增刪除回報與二度確認邏輯
// 🎯 方案二：刪除回報時，連帶永久刪除地底下的所有子評論
  async function handleDeleteReport() {
    if (!currentReportId) return;

    // 跳出第一層防護：Alert 詢問
    Alert.alert(
      "刪除回報", 
      "您確定要刪除這筆危險地點回報嗎？此操作將無法復原，且底下的所有留言與評論會被永久抹除。", 
      [
        { text: "取消", style: "cancel" },
        { 
          text: "確定刪除", 
          style: "destructive", 
          onPress: async () => {
            try {
              // 1. 先抓取該回報底下的 comments 子集合參照
              const commentsRef = collection(db, "reports", currentReportId, "comments");
              const commentsSnapshot = await getDocs(commentsRef);
              
              // 2. 將所有子評論的刪除動作打包成 Promise 陣列
              const deleteCommentsPromises = commentsSnapshot.docs.map((commentDoc) => 
                deleteDoc(doc(db, "reports", currentReportId, "comments", commentDoc.id))
              );
              
              // 3. 同步並行執行所有評論的刪除，確保全部清空
              await Promise.all(deleteCommentsPromises);

              // 4. 最後回頭刪除最外層的「回報主文件」
              await deleteDoc(doc(db, "reports", currentReportId));
              
              Alert.alert("刪除成功", "該筆回報及其所有相關評論已成功移除。");
              
              // 刪除成功後，自動返回個人主頁，主頁的即時監聽會自動扣除數量
              router.back(); 
            } catch (error) {
              console.error("連帶刪除失敗:", error);
              Alert.alert("操作失敗", "目前無法完整刪除該資料，請稍後再試。");
            }
          } 
        }
      ]
    );
  }

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
  deleteHeaderButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  deleteHeaderText: {
    color: colors.red,
    fontSize: fontSizes.bodySmall,
    fontWeight: "900",
  },
  content: {
    paddingHorizontal: 20,
  },
  scrollView: {
    flex: 1,
  },
  reportCard: {
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
    flexWrap: "wrap",
  },
  tag: {
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
  tagText: {
    marginLeft: 6,
    color: colors.black,
    fontSize: fontSizes.bodyLarge,
    fontWeight: "800",
    lineHeight: 22,
  },
  tagHash: {
    color: colors.black,
    fontSize: fontSizes.bodyLarge,
    fontWeight: "900",
    lineHeight: 22,
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
  voteIcon: {
    width: 21,
    height: 21,
    resizeMode: "contain",
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
  commentDate: {
    marginLeft: 8,
    color: colors.handle,
    fontSize: fontSizes.small,
    fontWeight: "800",
    lineHeight: 16,
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
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 8,
    paddingHorizontal: 20,
    backgroundColor: colors.background,
    zIndex: 8,
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
  commentSuccessOverlay: {
    position: "absolute",
    left: 20,
    right: 20,
    zIndex: 12,
    alignItems: "center",
  },
  commentSuccessBanner: {
    minHeight: 42,
    paddingVertical: 8,
    paddingLeft: 9,
    paddingRight: 16,
    borderRadius: 21,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.specialSoft,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 5,
    flexDirection: "row",
    alignItems: "center",
  },
  commentSuccessIconBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.specialSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  commentSuccessIcon: {
    width: 15,
    height: 15,
    resizeMode: "contain",
    tintColor: colors.special,
  },
  commentSuccessText: {
    marginLeft: 9,
    color: colors.black,
    fontSize: fontSizes.bodySmall,
    fontWeight: "900",
    lineHeight: 19,
  },
});
