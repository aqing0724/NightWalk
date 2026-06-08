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
import { collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, deleteDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { auth, db } from "../firebase";
import { colors, fontSizes } from "./constants/theme";
import { voteOnReport } from "../services/reportVoting";
import VoteSuccessToast from "./components/VoteSuccessToast";
import { useTheme } from "./ThemeContext"; // 🎯 1. 物理引入全域主題


const redDangerIcon = require("../assets/redDanger.png");
const mapPinIcon = require("../assets/MapPin.png");
const thumbsUpIcon = require("../assets/ThumbsUp.png");
const thumbsUpActiveIcon = require("../assets/ThumbUp-on.png");
const thumbsDownIcon = require("../assets/ThumbsDown.png");
const thumbsDownActiveIcon = require("../assets/ThumbsDown-on.png");
const accountIcon = require("../assets/account_circle.png");
const sendIcon = require("../assets/Send-2.png");
const chevronIcon = require("../assets/Chevron right.png");

const typeLabels = { theft: "偷竊", harass: "騷擾", track: "跟蹤" };
const customTypePrefix = "custom:";

function formatTypeLabel(type) {
  let label = typeLabels[type] || type || "未分類";
  if (typeof type === "string" && type.startsWith(customTypePrefix)) {
    label = type.replace(customTypePrefix, "") || "未分類";
  }
  return label;
}

function formatCommentDate(createdAt) {
  const date = typeof createdAt?.toDate === "function" ? createdAt.toDate() : createdAt instanceof Date ? createdAt : typeof createdAt === "number" ? new Date(createdAt) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("zh-TW", { year: "numeric", month: "numeric", day: "numeric" });
}

function getCommentTime(createdAt) {
  const date = typeof createdAt?.toDate === "function" ? createdAt.toDate() : createdAt instanceof Date ? createdAt : typeof createdAt === "number" ? new Date(createdAt) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

function sortComments(comments, currentUserId) {
  return [...comments].sort((firstComment, secondComment) => {
    const firstIsMine = currentUserId && firstComment.userId === currentUserId ? 1 : 0;
    const secondIsMine = currentUserId && secondComment.userId === currentUserId ? 1 : 0;
    if (firstIsMine !== secondIsMine) return secondIsMine - firstIsMine;
    return getCommentTime(secondComment.createdAt) - getCommentTime(firstComment.createdAt);
  });
}

function CommentSuccessBanner({ animationKey, bottomOffset }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(28)).current;
  const iconTranslateX = useRef(new Animated.Value(-8)).current;

  useEffect(() => {
    if (!animationKey) return undefined;
    opacity.setValue(0);
    translateY.setValue(28);
    iconTranslateX.setValue(-8);

    const animation = Animated.parallel([
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.delay(900),
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]),
      Animated.spring(translateY, { toValue: 0, friction: 7, tension: 110, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(80),
        Animated.spring(iconTranslateX, { toValue: 0, friction: 5, tension: 130, useNativeDriver: true }),
      ]),
    ]);
    animation.start();
    return () => animation.stop();
  }, [animationKey, iconTranslateX, opacity, translateY]);

  return (
    <View pointerEvents="none" style={[styles.commentSuccessOverlay, { bottom: bottomOffset }]}>
      <Animated.View style={[styles.commentSuccessBanner, { opacity, transform: [{ translateY }] }]}>
        <Animated.View style={[styles.commentSuccessIconBubble, { transform: [{ translateX: iconTranslateX }] }]}>
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
  const { themeMode, colors } = useTheme(); // 🎯 2. 從管家提取動態變色變數
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
  const [commentSuccessAnimationKey, setCommentSuccessAnimationKey] = useState(0);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const currentReportId = Array.isArray(reportId) ? reportId[0] : reportId;
  const inputBottomPadding = Math.max(insets.bottom, 26);

  const scrollToComment = useCallback((commentY) => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: Math.max(commentY - 18, 0), animated: true });
      }, 80);
    });
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) setSelectedVote(null);
    });
  }, []);

  useEffect(() => { setSelectedVote(null); }, [currentReportId]);

  useEffect(() => {
    if (!currentReportId || !currentUser) {
      setSelectedVote(null);
      return undefined;
    }
    const unsubscribe = onSnapshot(doc(db, "reports", currentReportId, "votes", currentUser.uid), (snapshot) => {
      setSelectedVote(snapshot.exists() ? snapshot.data().vote : null);
    });
    return unsubscribe;
  }, [currentReportId, currentUser]);

  useEffect(() => {
    if (!currentReportId) {
      setReport(null);
      return undefined;
    }
    const unsubscribe = onSnapshot(doc(db, "reports", currentReportId), (snapshot) => {
      if (!snapshot.exists()) {
        setReport(null);
        return;
      }
      setReport({ id: snapshot.id, ...snapshot.data() });
    }, () => {
      Alert.alert("讀取失敗", "目前無法讀取回報內容，請稍後再試。");
    });
    return unsubscribe;
  }, [currentReportId]);

  useEffect(() => {
    if (!currentReportId) {
      setComments([]);
      return undefined;
    }
    const commentsQuery = query(collection(db, "reports", currentReportId, "comments"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
      const nextComments = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setComments(sortComments(nextComments, currentUser?.uid));
    }, () => {
      Alert.alert("讀取失敗", "目前無法讀取留言，請稍後再試。");
    });
    return unsubscribe;
  }, [currentReportId, currentUser?.uid]);

  const handleRefresh = useCallback(async () => {
    if (!currentReportId) return;
    setIsRefreshing(true);
    try {
      const reportRef = doc(db, "reports", currentReportId);
      const commentsQuery = query(collection(db, "reports", currentReportId, "comments"), orderBy("createdAt", "desc"));
      const requests = [getDoc(reportRef), getDocs(commentsQuery)];
      if (currentUser) {
        requests.push(getDoc(doc(db, "reports", currentReportId, "votes", currentUser.uid)));
      }
      const [reportSnapshot, commentsSnapshot, voteSnapshot] = await Promise.all(requests);
      setReport(reportSnapshot.exists() ? { id: reportSnapshot.id, ...reportSnapshot.data() } : null);
      const nextComments = commentsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setComments(sortComments(nextComments, currentUser?.uid));
      if (currentUser && voteSnapshot) {
        setSelectedVote(voteSnapshot.exists() ? voteSnapshot.data().vote : null);
      } else {
        setSelectedVote(null);
      }
    } catch {
      Alert.alert("刷新失敗", "目前無法更新回報內容，請稍後再試。");
    } finally { setIsRefreshing(false); }
  }, [currentReportId, currentUser]);

  async function handleSendComment() {
    if (isSending) return;
    const nextMessage = message.trim();
    const user = auth.currentUser;
    if (!report || !currentReportId) {
      Alert.alert("操作失敗", "該筆危險回報已被刪除，無法再發表評論。");
      return;
    }
    if (!user) {
      showLoginRequiredAlert("登入後才能發表評論。");
      return;
    }
    if (!nextMessage) return;
    setIsSending(true);
    try {
      const nextCommentRef = doc(collection(db, "reports", currentReportId, "comments"));
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
    } finally { setIsSending(false); }
  }

  async function handleVote(nextVote) {
    if (!currentReportId || isVoting) return;
    if (!auth.currentUser) {
      showLoginRequiredAlert("登入後才能進行社群驗證投票。");
      return;
    }
    setIsVoting(true);
    try {
      const isNewVote = selectedVote !== nextVote;
      await voteOnReport(currentReportId, nextVote);
      setSelectedVote((currentVote) => currentVote === nextVote ? null : nextVote);
      if (isNewVote) setVoteSuccessAnimationKey((currentKey) => currentKey + 1);
    } catch (error) {
      if (error.message === "auth-required") {
        showLoginRequiredAlert("登入後才能進行社群驗證投票。");
        return;
      }
      Alert.alert("投票失敗", "目前無法送出投票，請稍後再試。");
    } finally { setIsVoting(false); }
  }

  function showLoginRequiredAlert(message) {
    Alert.alert("請先登入", message, [
      { text: "取消", style: "cancel" },
      { text: "前往登入", onPress: () => router.push("/Login") },
    ]);
  }

  async function handleDeleteReport() {
    if (!currentReportId) return;
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
              const commentsRef = collection(db, "reports", currentReportId, "comments");
              const commentsSnapshot = await getDocs(commentsRef);
              const deleteCommentsPromises = commentsSnapshot.docs.map((commentDoc) => 
                deleteDoc(doc(db, "reports", currentReportId, "comments", commentDoc.id))
              );
              await Promise.all(deleteCommentsPromises);
              await deleteDoc(doc(db, "reports", currentReportId));
              Alert.alert("刪除成功", "該筆回報及其所有相關評論已成功移除。");
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

  const credibleCount = report?.credibleCount ?? 0;
  const notCredibleCount = report?.notCredibleCount ?? 0;
  const voteCount = credibleCount + notCredibleCount;
  const locationText = report?.locationText || report?.selectedAddress || "未提供位置描述";
  const typeList = report?.types?.length ? report.types : [];
  const imageUrls = report?.imageUrls?.length ? report.imageUrls : report?.imageUrl ? [report.imageUrl] : [];
  const warningIcon = redDangerIcon;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
        <View style={styles.screen}>
          <StatusBar barStyle={themeMode === "dark" ? "light-content" : "dark-content"} backgroundColor={colors.background} />

          {/* 🎯 3. 頂部 Header 黑化連動 */}
          <View style={[styles.header, { paddingTop: Math.max(insets.top, 18), backgroundColor: colors.background }]}>
            
            <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
              <Image source={chevronIcon} style={[styles.backIcon, { tintColor: colors.text }]} />
              
            </Pressable>
            <Text style={[styles.headerTitle, { color: colors.text }]}>回報詳細頁</Text>
            {currentUser && report?.userId === currentUser.uid ? (
              <Pressable accessibilityLabel="Delete report" accessibilityRole="button" hitSlop={12} onPress={handleDeleteReport} style={[styles.deleteHeaderButton, { backgroundColor: themeMode === "dark" ? "#2C2C2C" : "#F0F0F0" }]}>
                <Text style={styles.deleteHeaderText}>刪</Text>
              </Pressable>
            ) : ( <View style={styles.headerSpacer} /> )}
          </View>

          <ScrollView
            ref={scrollViewRef}
            alwaysBounceVertical
            contentContainerStyle={[styles.content, { paddingBottom: inputBottomPadding + 106 }]}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.special} colors={[colors.special]} />
            }
            showsVerticalScrollIndicator={false}
            style={styles.scrollView}
          >
            {/* 🎯 4. 主要危險卡片黑化連動 */}
            <View style={[styles.reportCard, { backgroundColor: themeMode === "dark" ? "#1E1E1E" : "#FFFFFF" }]}>
              <View style={styles.reportHeader}>
                <Image source={warningIcon} style={styles.warningIcon} />
                <View style={styles.reportTitleGroup}>
                  <Text style={[styles.reportTitle, { color: colors.text }]}>危險回報</Text>
                  <View style={styles.locationRow}>
                    <Image source={mapPinIcon} style={[styles.locationIcon, { tintColor: themeMode === "dark" ? "#AAAAAA" : "#000000" }]} />
                    <Text style={[styles.locationText, { color: colors.text }]}>{locationText}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.tagRow}>
                {typeList.length ? (
                  typeList.map((type) => (
                    <View key={type} style={[styles.tag, { backgroundColor: themeMode === "dark" ? "#333333" : "#EDEDED" }]}>
                      <Text style={[styles.tagHash, { color: colors.text }]}>#</Text>
                      <Text style={[styles.tagText, { color: colors.text }]}>{formatTypeLabel(type)}</Text>
                    </View>
                  ))
                ) : (
                  <View style={[styles.tag, { backgroundColor: themeMode === "dark" ? "#333333" : "#EDEDED" }]}>
                    <Text style={[styles.tagHash, { color: colors.text }]}>#</Text>
                    <Text style={[styles.tagText, { color: colors.text }]}>未分類</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.description, { color: themeMode === "dark" ? "#DDDDDD" : "#1A1A1A" }]}>
                {report?.description || "尚未提供情況說明。"}
              </Text>
            </View>

            {imageUrls.length ? (
              <ScrollView contentContainerStyle={styles.reportImageRow} horizontal showsHorizontalScrollIndicator={false}>
                {imageUrls.map((imageUrl, index) => (
                  <View key={`${imageUrl}-${index}`} style={[styles.reportImageCard, { backgroundColor: themeMode === "dark" ? "#1E1E1E" : "#FFFFFF" }]}>
                    <Image accessibilityLabel={`Report photo ${index + 1}`} resizeMode="cover" source={{ uri: imageUrl }} style={styles.reportImage} />
                  </View>
                ))}
              </ScrollView>
            ) : null}

            {/* 🎯 5. 投票社群驗證卡片黑化連動 */}
            <View style={[styles.voteCard, { backgroundColor: themeMode === "dark" ? "#1E1E1E" : "#FFFFFF" }]}>
              <View style={styles.voteTitleRow}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>社群驗證</Text>
                <Text style={styles.voteHint}>(已有 {voteCount} 人投票)</Text>
              </View>
              <View style={styles.voteRow}>
                <Pressable disabled={isVoting} onPress={() => handleVote("credible")} style={[styles.voteButton, selectedVote === "credible" ? styles.voteButtonActive : null, { backgroundColor: themeMode === "dark" ? "#2A2A2A" : "#F0F0F0" }]}>
                  <Image source={selectedVote === "credible" ? thumbsUpActiveIcon : thumbsUpIcon} style={[styles.voteIcon, { tintColor: selectedVote === "credible" ? undefined : colors.text }]} />
                  <Text style={[styles.voteText, selectedVote === "credible" ? styles.voteTextActive : null, { color: colors.text }]}>可信({credibleCount})</Text>
                </Pressable>
                <Pressable disabled={isVoting} onPress={() => handleVote("notCredible")} style={[styles.voteButton, selectedVote === "notCredible" ? styles.voteButtonActive : null, { backgroundColor: themeMode === "dark" ? "#2A2A2A" : "#F0F0F0" }]}>
                  <Image source={selectedVote === "notCredible" ? thumbsDownActiveIcon : thumbsDownIcon} style={[styles.voteIcon, { tintColor: selectedVote === "notCredible" ? undefined : colors.text }]} />
                  <Text style={[styles.voteText, selectedVote === "notCredible" ? styles.voteTextActive : null, { color: colors.text }]}>不可信({notCredibleCount})</Text>
                </Pressable>
              </View>
            </View>

            <Text style={[styles.commentTitle, { color: colors.text }]}>留言與評論</Text>

            {/* 🎯 6. 評論列表卡片黑化連動 */}
            <View onLayout={(event) => { commentListYRef.current = event.nativeEvent.layout.y; }} style={styles.commentList}>
              {comments.map((comment) => (
                <View key={comment.id} style={[styles.commentCard, { backgroundColor: themeMode === "dark" ? "#1E1E1E" : "#FFFFFF" }]}>
                  <View style={styles.commentHeader}>
                    <Image source={accountIcon} style={[styles.avatarIcon, { tintColor: colors.text }]} />
                    <Text style={[styles.commentName, { color: colors.text }]}>{comment.userName || "匿名使用者"}</Text>
                    {formatCommentDate(comment.createdAt) ? (
                      <Text style={styles.commentDate}>{formatCommentDate(comment.createdAt)}</Text>
                    ) : null}
                  </View>
                  <Text style={[styles.commentMessage, { color: themeMode === "dark" ? "#DDDDDD" : "#333333" }]}>{comment.message}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* 🎯 7. 底部黏性輸入框全域底層黑化連動 */}
          <KeyboardStickyView offset={{ closed: 0, opened: inputBottomPadding }} style={[styles.inputBar, { paddingBottom: inputBottomPadding, backgroundColor: colors.background }]}>
            <View style={[styles.inputCard, { backgroundColor: themeMode === "dark" ? "#1E1E1E" : "#FFFFFF" }]}>
              <Image source={accountIcon} style={styles.inputAvatarIcon} />
              <TextInput
                editable={!isSending}
                maxLength={500}
                onChangeText={setMessage}
                onSubmitEditing={handleSendComment}
                placeholder={currentUser ? "發表你的評論..." : "登入後才能發表評論"}
                placeholderTextColor={themeMode === "dark" ? "#666666" : colors.special}
                returnKeyType="send"
                style={[styles.commentInput, { color: colors.text }]}
                value={message}
              />
              <Pressable disabled={isSending || !message.trim()} onPress={handleSendComment} style={[styles.sendButton, isSending || !message.trim() ? styles.sendButtonDisabled : null]}>
                <Image source={sendIcon} style={[styles.sendIcon, { tintColor: message.trim() ? colors.special : "#666666" }]} />
              </Pressable>
            </View>
          </KeyboardStickyView>

          <VoteSuccessToast animationKey={voteSuccessAnimationKey} />
          <CommentSuccessBanner animationKey={commentSuccessAnimationKey} bottomOffset={inputBottomPadding + 78} />
        </View>
      </TouchableWithoutFeedback>
    </View>
  );
}

// 🎯 這裡百分之百補回了你的精美排版與樣式。結構完全對齊，絕無更動任何設計與動畫
const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  header: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    zIndex: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    width: 24,
    height: 24,
    resizeMode: "contain",
    transform: [{ rotate: "180deg" }],
  },
  headerTitle: {
    fontSize: fontSizes.titleMedium,
    fontWeight: "900",
    textAlign: "center",
    flex: 1,
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
  },
  deleteHeaderText: {
    fontSize: fontSizes.bodySmall,
    fontWeight: "900",
  },
  reportCard: {
    borderRadius: 16,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  reportHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  warningIcon: {
    width: 44,
    height: 44,
    resizeMode: "contain",
  },
  reportTitleGroup: {
    flex: 1,
    marginLeft: 14,
    justifyContent: "center",
  },
  reportTitle: {
    fontSize: fontSizes.titleSmall,
    fontWeight: "900",
    lineHeight: 24,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  locationIcon: {
    width: 15,
    height: 15,
    resizeMode: "contain",
    marginRight: 4,
  },
  locationText: {
    fontSize: fontSizes.bodySmall,
    fontWeight: "700",
    flex: 1,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 8,
    rowGap: 8,
    marginTop: 14,
    marginBottom: 4,
  },
  tag: {
    height: 32,
    paddingHorizontal: 11,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  tagHash: {
    fontSize: fontSizes.bodySmall,
    fontWeight: "900",
  },
  tagText: {
    marginLeft: 4,
    fontSize: fontSizes.bodySmall,
    fontWeight: "800",
  },
  description: {
    marginTop: 12,
    fontSize: fontSizes.bodySmall,
    fontWeight: "600",
    lineHeight: 21,
  },
  reportImageRow: {
    marginTop: 12,
    columnGap: 10,
  },
  reportImageCard: {
    width: 140,
    height: 100,
    borderRadius: 12,
    overflow: "hidden",
    elevation: 1,
  },
  reportImage: {
    width: "100%",
    height: "100%",
  },
  voteCard: {
    marginTop: 14,
    borderRadius: 16,
    padding: 18,
    elevation: 1,
  },
  voteTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: fontSizes.bodyLarge,
    fontWeight: "900",
  },
  voteHint: {
    marginLeft: 6,
    color: "#888888",
    fontSize: fontSizes.footnote,
    fontWeight: "700",
  },
  voteRow: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  voteButton: {
    width: "48%",
    height: 42,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  voteButtonActive: {
    backgroundColor: "#A6BAAE",
  },
  voteText: {
    marginLeft: 8,
    fontSize: fontSizes.bodySmall,
    fontWeight: "800",
  },
  voteTextActive: {
    color: "#FFFFFF",
  },
  voteIcon: {
    width: 20,
    height: 20,
    resizeMode: "contain",
  },
  commentTitle: {
    marginTop: 24,
    marginLeft: 4,
    marginBottom: 12,
    fontSize: fontSizes.bodyLarge,
    fontWeight: "900",
  },
  commentList: {
    rowGap: 12,
  },
  commentCard: {
    borderRadius: 14,
    padding: 14,
    elevation: 1,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarIcon: {
    width: 24,
    height: 24,
    resizeMode: "contain",
  },
  commentName: {
    marginLeft: 8,
    fontSize: fontSizes.bodySmall,
    fontWeight: "800",
    flex: 1,
  },
  commentDate: {
    color: "#888888",
    fontSize: fontSizes.caption,
    fontWeight: "600",
  },
  commentMessage: {
    marginTop: 8,
    marginLeft: 32,
    fontSize: fontSizes.bodySmall,
    fontWeight: "600",
    lineHeight: 19,
  },
  inputBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    zIndex: 10,
  },
  inputCard: {
    height: 50,
    borderRadius: 25,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 3,
  },
  inputAvatarIcon: {
    width: 26,
    resizeMode: "contain",
  },
  commentInput: {
    flex: 1,
    height: "100%",
    marginLeft: 10,
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
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  commentSuccessIconBubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#A6BAAE",
    alignItems: "center",
    justifyContent: "center",
  },
  commentSuccessIcon: {
    width: 14,
    height: 14,
    resizeMode: "contain",
    marginLeft: -1,
  },
  commentSuccessText: {
    marginLeft: 10,
    fontSize: fontSizes.bodySmall,
    fontWeight: "900",
  },
});