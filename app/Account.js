const settingsIcon = require("../assets/settings.png"); 
const nightModeIcon = require("../assets/Moon.png");
const accountCircle = require("../assets/account_circle.png");
const messageSquare = require("../assets/Messagesquare.png"); 
const mailIcon = require("../assets/Mail2.png");
const compassIcon = require("../assets/Compass.png");
const typeIcon = require("../assets/Type.png");
const clockIcon = require("../assets/Clock.png");

import { useTheme } from "./ThemeContext"; // 🎯 1. 引入全域主題鉤子

import { useEffect, useState } from "react"; // 1. 確保有引入 useEffect 和 useState
import {
  StatusBar,
  StyleSheet,
  Text,
  View,
  Pressable,
  FlatList,
  Switch,
  Alert,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { onAuthStateChanged, signOut, deleteUser } from "firebase/auth";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 2. 引入 Firestore 相關語法
import { collection, query, where, orderBy, onSnapshot, collectionGroup } from "firebase/firestore"; 

import { auth, db } from "../firebase"; // 3. 確保引入了 db (Firestore 實例)
import { colors, fontSizes } from "./constants/theme";

export default function AccountPage() {
  // 🎯 修改：加入 currentAvatarSource（圖片資產）與 changeAvatar（變換函式）
  const { themeMode, colors, toggleTheme, currentAvatarSource, changeAvatar, currentAvatarId,allAvatars } = useTheme();
  const [currentView, setCurrentView] = useState("profile"); // "profile" 或 "settings"
  const [showAvatarPicker, setShowAvatarPicker] = useState(false); // 控制頭像選單
  const [isDarkMode, setIsDarkMode] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  
  // 🎯 建立儲存 Firebase 資料的 State（取代原本的模擬資料）
  const [historyData, setHistoryData] = useState([]);
  const [userStats, setUserStats] = useState({ reports: 0, likes: 0 });

  

  // 檢查登入狀態
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthChecked(true);

      if (!user) {
        router.replace("/Login");
      }
    });
  }, [router]);

  // 監聽回報與評論的大合體
  useEffect(() => {
    if (!currentUser) return;

    let reportsData = [];
    let commentsData = [];

    // 🎯 歷史紀錄大合體的更新函式
    const updateHistoryList = () => {
      // 把兩邊撈到的資料揉成一個陣列，並加上 type 標記方便 renderItem 識別
      const combined = [
        ...reportsData.map(item => ({ ...item, listType: "report" })),
        ...commentsData.map(item => ({ ...item, listType: "comment" }))
      ];

      // 依據時間 (createdAt) 從新到舊排序
      combined.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });

      setHistoryData(combined);

      const totalLikes = reportsData.reduce((sum, item) => {
        return sum + (item.credibleCount || 0);
      }, 0);
      // 自動更新數據看板中的「總回報數」
      setUserStats((prev) => ({
        ...prev,
        reports: reportsData.length,
        likes: totalLikes,           // 🎯 讓這邊動起來！反映即時加總的讚數
      }));
    };

    // ─── 監聽 1：使用者發布的「回報」 ───
    const reportsQuery = query(
      collection(db, "reports"),
      where("userId", "==", currentUser.uid),
      orderBy("createdAt", "desc")
    );
    const unsubscribeReports = onSnapshot(reportsQuery, (snapshot) => {
      reportsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      updateHistoryList();
    }, (error) => console.error("讀取回報失敗:", error));

    // ─── 監聽 2：跨貼文監聽使用者寫過的「評論」 ───
    // 💡 這裡會去撈取所有 reports/*/comments 底下 userId 等於目前登入者的資料
    const commentsQuery = query(
      collectionGroup(db, "comments"),
      where("userId", "==", currentUser.uid)
    );
    const unsubscribeComments = onSnapshot(commentsQuery, (snapshot) => {
      commentsData = snapshot.docs.map(doc => {
        const data = doc.data();
        const reportSnapshot = doc.ref.parent.parent; // 找到父貼文的參照
        const reportId = doc.ref.parent.parent?.id || ""; 
        return { id: doc.id, reportId, 
          locationText: data.locationText || "未知名稱",
          ...data };
      });
      updateHistoryList();
    }, (error) => {
      console.error("讀取評論失敗，可能需要建立 Index 索引:", error);
    });

    // 組件卸載時，把兩個對講機都關掉
    return () => {
      unsubscribeReports();
      unsubscribeComments();
    };
  }, [currentUser]);

  async function handleSignOut() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("登出失敗:", error);
      Alert.alert("登出失敗", "目前無法登出，請稍後再試。");
    }
  }



const renderItem = ({ item }) => {
    const isReport = item.listType === "report";

    return (
      <Pressable 
        // 🎯 修正：卡片背景色跟隨 colors.surfaceMuted（暗色時變深灰），消除原本寫死的 #FFFFFF
        style={[styles.card, { backgroundColor: themeMode === "dark" ? "#1E1E1E" : "#FFFFFF" }]} 
        onPress={() => {
          const targetReportId = isReport ? item.id : item.reportId;
          if (targetReportId) {
            router.push({ pathname: "/detail", params: { reportId: targetReportId } });
          } else {
            Alert.alert("提示", "無法追蹤該資料的原始回報頁面。");
          }
        }}
      >

        <View style={styles.cardLeft}>
          <Image 
            source={isReport ? mailIcon : messageSquare} 
            style={[
              styles.cardItemIcon,
              // 🎯 修正：圖示 tintColor 改用全域的 colors.text
              { tintColor: colors.text } 
            ]} 
          />
          <Text style={[styles.cardTypeText, { color: themeMode === "dark" ? "#AAAAAA" : "#777777", marginTop: 4 }]}>
            {isReport ? "回報" : "評論"}
          </Text>
        </View>

        <View style={styles.cardMiddle}>
          {isReport ? (
            <>
              {/* 🎯 修正：標題文字顏色跟隨 colors.text */}
              <Text style={[styles.cardTitle, { color: colors.text }]}>{item.locationText || "未知名稱"}</Text>
              
              <View style={styles.tagWrapper}>
                {/* 🎯 修正：標籤底色在暗色模式時稍微加深 */}
                <View style={[styles.grayTag, { backgroundColor: themeMode === "dark" ? "#333333" : "#EDEDED" }]}>
                  <Text style={[styles.grayTagText, { color: themeMode === "dark" ? "#DDDDDD" : "#555555" }]}>
                    {item.types && item.types.length > 0 
                      ? item.types.map(t => t === "theft" ? "偷竊" : t === "harass" ? "騷擾" : t === "track" ? "跟蹤" : t).join(", ") 
                      : "一般"}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{item.locationText || "未知名稱"}</Text>
              <Text style={[styles.cardSubText, { color: themeMode === "dark" ? "#AAAAAA" : "#888888" }]} numberOfLines={1}>
                {item.message || "空白內容"}
              </Text>
            </>
          )}
          
          <View style={styles.timeRow}>
            <Image 
              source={clockIcon} 
              style={[
                styles.timeIcon, 
                // 🎯 修正：時鐘圖示 tintColor 跟隨 colors.textMuted
                { tintColor: themeMode === "dark" ? "#AAAAAA" : "#888888" }
              ]} 
            />
            <Text style={[styles.cardSubText, { color: themeMode === "dark" ? "#AAAAAA" : "#888888" }]}>
              {item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : "近期"}
            </Text>
          </View>
        </View>

        <View style={styles.cardRight}>
          <Text style={styles.arrow}>❯</Text>
        </View>
      </Pressable>
    );
  };
  if (!authChecked || !currentUser) {
    return <View style={styles.screen} />;
  }

 if (currentView === "settings") {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>                 
        <StatusBar barStyle={themeMode === "dark" ? "light-content" : "dark-content"} backgroundColor={colors.background} />

        {/* 頂部導航 */}
        <View style={styles.settingsHeader}>
          <Pressable onPress={() => setCurrentView("profile")} style={{ padding: 8 }}>
            <Text style={{ fontSize: fontSizes.titleLarge, fontWeight: "bold", color: colors.text }}>❮</Text>            
          </Pressable>
          <Text style={{ fontSize: fontSizes.titleLarge, fontWeight: "bold", color: colors.text }}>設定</Text>          
          <View style={{ width: 32 }} />
        </View>
{/* 大頭貼與點擊多一層選單 */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarPlaceholderLarge}>
            <Image source={currentAvatarSource} style={styles.avatarImage} />
          </View>
          
          {/* 🎯 2. 點擊編輯頭像：切換開關狀態，讓下面的圖片選單展開或收合 */}
          <Pressable onPress={() => setShowAvatarPicker(!showAvatarPicker)}>
            <Text style={[styles.editAvatarText, { color: showAvatarPicker ? "#A3B7AC" : colors.text }]}>
              {showAvatarPicker ? "收起頭像選單 ▲" : "編輯頭像 ▼"}
            </Text>
          </Pressable>

          {/* 🎯 3. 多一層條件渲染：只有當 showAvatarPicker 為 true 時，三張圖片才會直觀顯示出來 */}
          {showAvatarPicker && (
            <View style={styles.avatarPickerRow}>
              {Object.keys(allAvatars).map((key) => {
                const isSelected = currentAvatarId === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => {
                      changeAvatar(key);
                      // 選完之後如果你希望自動收起來，可以把下面這行註解解開：
                      // setShowAvatarPicker(false);
                    }}
                    style={[
                      styles.avatarPickerItem,
                      { borderColor: isSelected ? "#A3B7AC" : "transparent" }
                    ]}
                  >
                    <Image source={allAvatars[key]} style={styles.avatarPickerImage} />
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* 基本資訊 */}
        {/* 🎯 修正：基本資訊標題文字動態綁定 colors.text */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>基本資訊</Text>
        <View style={[styles.cardGroup, { backgroundColor: themeMode === "dark" ? "#1E1E1E" : "#FFFFFF" }]}>          
          {/* 🎯 修正：橫列邊框色在夜間模式時自動換成深灰色分割線 */}
          <View style={[styles.row, { borderBottomColor: themeMode === "dark" ? "#2C2C2C" : "#F0F0F0" }]}>
            <View style={styles.rowLeft}>
              <Image source={typeIcon} style={[styles.rowItemIcon, { tintColor: colors.text }]} />
              {/* 🎯 修正：欄位名稱標籤文字改為 dynamic colors.text */}
              <Text style={[styles.rowLabel, { color: colors.text }]}>使用者名稱</Text>
            </View>
            {/* 🎯 修正：欄位真實數值在夜間改為淡灰色，白天為深灰，對齊截圖質感 */}
            <Text style={[styles.rowValue, { color: themeMode === "dark" ? "#AAAAAA" : "#777777" }]}>
              {currentUser.displayName || currentUser.email?.split('@')[0] || "夜行者__22"}
            </Text>
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <View style={styles.rowLeft}>
              <Image source={mailIcon} style={[styles.rowItemIcon, { tintColor: colors.text }]} />
              <Text style={[styles.rowLabel, { color: colors.text }]}>電子郵件</Text>
            </View>
            <Text style={[styles.rowValue, { color: themeMode === "dark" ? "#AAAAAA" : "#777777" }]} numberOfLines={1}>
              {currentUser.email || "xxxxxxx@gmail.com"}
            </Text>
          </View>
        </View>

        {/* 其他設定 */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>其他</Text>
        <View style={[styles.cardGroup, { backgroundColor: themeMode === "dark" ? "#1E1E1E" : "#FFFFFF" }]}>
          <View style={[styles.row, { borderBottomColor: themeMode === "dark" ? "#2C2C2C" : "#F0F0F0" }]}>
            <View style={styles.rowLeft}>
              {/* 🎯 修正：月亮 icon 點亮時是你們專屬莫蘭迪綠 (#A3B7AC)，關閉時動態跟隨主色調（白天黑/夜間白） */}
              <Image
                source={nightModeIcon}
                style={[
                  styles.rowItemIcon,
                  { tintColor: colors.text }
                ]}
              />
              <Text style={[styles.rowLabel, { color: colors.text }]}>夜間模式</Text>
            </View>
            <Switch
              trackColor={{ false: "#767577", true: colors.special }}
              thumbColor={themeMode === "dark" ? colors.white : "#f4f3f4"}
              onValueChange={toggleTheme}
              value={themeMode === "dark"}
            />
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <View style={styles.rowLeft}>
              <Image source={compassIcon} style={[styles.rowItemIcon, { tintColor: colors.text }]} />
              <Text style={[styles.rowLabel, { color: colors.text }]}>App導覽</Text>
            </View>
            <Text style={[styles.arrow, { color: themeMode === "dark" ? "#666666" : "#CCCCCC" }]}>❯</Text>
          </View>
        </View>

        <View style={styles.buttonGroup}>
          <Pressable 
            style={[styles.logoutButton, { backgroundColor: themeMode === "dark" ? "#1E1E1E" : "#FFFFFF", borderColor: themeMode === "dark" ? "#2C2C2C" : "#E0E0E0" }]}
            onPress={() => {
              Alert.alert("登出帳號", "確定要登出嗎？", [
                { text: "取消", style: "cancel" },
                { text: "確定", style: "destructive", onPress: handleSignOut }
              ]);
            }}
          >
            <Text style={styles.logoutText}>登出</Text>
          </Pressable>

          <Pressable 
            style={styles.deleteButton} 
            onPress={() => {
              Alert.alert("危險操作", "您確定要刪除帳號嗎？此操作將無法復原。", [
                { text: "取消", style: "cancel" },
                { text: "確定刪除", style: "destructive", onPress: () => deleteUser(currentUser) }
              ]);
            }}
          >
            <Text style={styles.deleteText}>刪除帳號</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
<View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* 1. 頂部個人資訊 */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.avatarPlaceholder}>
            <Image source={currentAvatarSource} style={styles.avatarImage} />
          </View>
            <Text style={[styles.userName, { color: colors.text }]}>
            {currentUser.displayName || currentUser.email?.split('@')[0] || "使用者名稱"}
          </Text>
        </View>
          <Pressable onPress={() => setCurrentView("settings")} style={styles.settingButton}>
          <Image
             source={settingsIcon}
              style={[
              styles.navIcon,
              { tintColor: colors.text }
        ]}
      />
          </Pressable>
      </View>

      {/* 2. 數據看板 */}
      <View style={styles.statsContainer}>
        <View style={[styles.statBox, styles.statDivider]}>
          {/* 顯示從 Firebase 計算出來的總數量 */}
          <Text style={styles.statNumber}>{userStats.reports}</Text>
          <Text style={styles.statLabel}>總回報數</Text>
        </View>
        <View style={styles.statCenterDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{userStats.likes}</Text>
          <Text style={styles.statLabel}>獲得讚數</Text>
        </View>
      </View>

      {/* 3. 歷史紀錄列表 */}
      <FlatList
        data={historyData}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
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
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    marginTop: 20,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "transparent", 
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  userName: {
    fontSize: fontSizes.titleLarge,
    fontWeight: "bold",
    marginLeft: 16,
  
  },
  settingButton: {
    padding: 8,
  },
  navIcon: {
    width: 28,
    height: 28,
    resizeMode: "contain",
  },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "#A3B7AC", // 圖片中的莫蘭迪綠
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statDivider: {
    borderRightWidth: 1,
    borderRightColor: "rgba(255, 255, 255, 0.3)",
  },
  statNumber: {
    fontSize: fontSizes.heading,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  statLabel: {
    fontSize: fontSizes.labelSmall,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 130, 
  },
  card: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardLeft: {
    alignItems: "center",
    justifyContent: "center",
    width: 50,

  },
  iconPlaceholder: {
    fontSize: fontSizes.heading,
    marginBottom: 4,
  },
  cardTypeText: {
    fontSize: fontSizes.small,
    fontWeight: "bold",
    color: "#1A1A1A",
  },
  cardMiddle: {
    flex: 1,
    paddingHorizontal: 16,
  },
  cardTitle: {
    fontSize: fontSizes.bodyLarge,
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 4,
  },
  cardSubText: {
    fontSize: fontSizes.small,
    color: "#888888",
    marginTop: 2,
  },
  cardRight: {
    justifyContent: "center",
  },
  arrow: {
    fontSize: fontSizes.bodyLarge,
    color: "#CCCCCC",
  },
  // 🎯 請把這些新樣式貼進原本的 StyleSheet.create 裡面：
  settingsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 56,
  },
  avatarSection: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 20,
  },
  avatarPlaceholderLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  editAvatarText: {
    fontSize: fontSizes.bodySmall,
    fontWeight: "bold",
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: fontSizes.body,
    fontWeight: "bold",
    color: "#000000",
    marginLeft: 24,
    marginBottom: 8,
    marginTop: 16,
  },
  cardGroup: {
    marginHorizontal: 20,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: 50,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowIcon: {
    fontSize: fontSizes.titleSmall,
    marginRight: 12,
  },
  rowLabel: {
    fontSize: fontSizes.body,
    fontWeight: "600",
    color: "#000000",
  },
  rowValue: {
    fontSize: fontSizes.body,
    fontWeight: "600",
    color: "#777777",
    maxWidth: 180,
  },
  buttonGroup: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  logoutButton: {
    height: 50,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  logoutText: {
    color: "#FF5B5B",
    fontSize: fontSizes.bodyLarge,
    fontWeight: "bold",
  },
  deleteButton: {
    height: 50,
    backgroundColor: "#FF7E7E",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: {
    color: "#FFFFFF",
    fontSize: fontSizes.bodyLarge,
    fontWeight: "bold",
  },
  // 🎯 3. 確保最底下的 styles 有這一條，控制設定選單小圖示的大小
  rowItemIcon: {
    width: 24,
    height: 24,
    resizeMode: "contain",
    marginRight: 12,
  },

  compassIcon: {
    width: 24,
    height: 24,
    resizeMode: "contain",
    marginRight: 12,
  },
  typeIcon: {
    width: 24,
    height: 24,
    resizeMode: "contain",
    marginRight: 12,
  },
  mailIcon: {
    width: 24,
    height: 24,
    resizeMode: "contain",
    marginRight: 12,
  },
  cardItemIcon: {
    width: 35, 
    height: 35,
    resizeMode: "contain",
  },
  // 🎯 3. 補上標籤與時鐘的視覺樣式
  tagWrapper: {
    flexDirection: "row", // 讓長方形只包裹文字寬度，不延伸到全滿
    marginTop: 4,
    marginBottom: 6,
  },
  grayTag: {
    backgroundColor: "#EDEDED", // 淺灰色墊底
    paddingHorizontal: 8,       // 左右留白
    paddingVertical: 3,         // 上下留白
    borderRadius: 6,            // 圓角長方形
  },
  grayTagText: {
    fontSize: fontSizes.small,
    color: "#555555",           // 微深灰字體，看得很清楚
    fontWeight: "600",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",       // 讓時鐘圖片跟時間文字對齊
    marginTop: 4,
  },
  timeIcon: {
    width: 14,                  // 配合小字的大小
    height: 14,
    resizeMode: "contain",
    marginRight: 4,             // 與時間文字的小間距
  },
  // 🎯 請直接貼在 styles 大括號內部的最尾端
  avatarPickerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
    gap: 12, // 讓三張圖之間有舒適的間距
  },
  avatarPickerItem: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 3, // 用 3 號邊框來凸顯選中狀態
    padding: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarPickerImage: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
});
