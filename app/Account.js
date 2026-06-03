import { useEffect, useState } from "react"; // 1. 確保有引入 useEffect 和 useState
import {
  StatusBar,
  StyleSheet,
  Text,
  View,
  Pressable,
  FlatList,
  Switch,
  Alert
} from "react-native";
import { useRouter } from "expo-router";
import { onAuthStateChanged,signOut,deleteUser } from "firebase/auth";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 2. 引入 Firestore 相關語法
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore"; 

import { auth, db } from "../firebase"; // 3. 確保引入了 db (Firestore 實例)
import { colors, fontSizes } from "./constants/theme";

export default function AccountPage() {
  const [currentView, setCurrentView] = useState("profile"); // "profile" 或 "settings"
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

  useEffect(() => {
    if (!currentUser) return;

    const reportsQuery = query(
      collection(db, "reports"),
where("id", "==", currentUser.uid), // 
       orderBy("createdAt", "desc")
    );

    // 開始即時監聽資料庫變更
    const unsubscribe = onSnapshot(reportsQuery, (snapshot) => {
      const fetchedReports = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      setHistoryData(fetchedReports);

      // 自動更新數據看板中的「總回報數」
      setUserStats((prev) => ({
        ...prev,
        reports: fetchedReports.length,
        // 如果資料庫欄位有存按讚數，也可以在這邊加總計算
      }));
    }, (error) => {
      console.error("讀取 Firebase 失敗:", error);
    });

    return unsubscribe; // 組件卸載時取消監聽
  }, [currentUser]);


  // 渲染每一條歷史紀錄卡片
  const renderItem = ({ item }) => (
    <Pressable style={styles.card}>
      <View style={styles.cardLeft}>
        <Text style={styles.iconPlaceholder}>
          {item.type === "report" ? "✉️" : "💬"}
        </Text>
        <Text style={styles.cardTypeText}>
          {item.type === "report" ? "回報" : "評論"}
        </Text>
      </View>

      <View style={styles.cardMiddle}>
        {/* 💡 這裡的 item.locationText 和 item.createdAt 需對齊你們 Firebase 存的欄位名稱 */}
        <Text style={styles.cardTitle}>{item.locationText || "未知名稱"}</Text>
        <Text style={styles.cardSubText}>🙁 {item.tag || "一般"}</Text>
        <Text style={styles.cardSubText}>
          🕒 {item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : "近期"}
        </Text>
      </View>

      <View style={styles.cardRight}>
        <Text style={styles.arrow}>❯</Text>
      </View>
    </Pressable>
  );

  if (!authChecked || !currentUser) {
    return <View style={styles.screen} />;
  }

  if (currentView === "settings") {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
        
        {/* 頂部導航 */}
        <View style={styles.settingsHeader}>
          <Pressable onPress={() => setCurrentView("profile")} style={{ padding: 8 }}>
            <Text style={{ fontSize: 22, fontWeight: "bold" }}>❮</Text>
          </Pressable>
          <Text style={{ fontSize: 22, fontWeight: "bold", color: "#000000" }}>設定</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* 大頭貼 */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarPlaceholderLarge}>
            <Text style={{ fontSize: 44 }}>👤</Text>
          </View>
          <Pressable><Text style={styles.editAvatarText}>編輯頭像</Text></Pressable>
        </View>

        {/* 基本資訊 */}
        <Text style={styles.sectionTitle}>基本資訊</Text>
        <View style={styles.cardGroup}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowIcon}>👤</Text>
              <Text style={styles.rowLabel}>使用者名稱</Text>
            </View>
            <Text style={styles.rowValue}>{currentUser.displayName || "夜行者__22"}</Text>
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowIcon}>✉️</Text>
              <Text style={styles.rowLabel}>電子郵件</Text>
            </View>
            <Text style={styles.rowValue} numberOfLines={1}>{currentUser.email || "xxxxxxx@gmail.com"}</Text>
          </View>
        </View>

        {/* 其他設定 */}
        <Text style={styles.sectionTitle}>其他</Text>
        <View style={styles.cardGroup}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowIcon}>🌙</Text>
              <Text style={styles.rowLabel}>夜間模式</Text>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={setIsDarkMode}
              trackColor={{ false: "#D1D1D6", true: "#A3B7AC" }}
              thumbColor={"#FFFFFF"}
            />
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowIcon}>🧭</Text>
              <Text style={styles.rowLabel}>App導覽</Text>
            </View>
            <Text style={styles.arrow}>❯</Text>
          </View>
        </View>

        {/* 功能按鈕 */}
        <View style={styles.buttonGroup}>
          <Pressable 
            style={styles.logoutButton} 
            onPress={() => {
              Alert.alert("登出帳號", "確定要登出嗎？", [
                { text: "取消", style: "cancel" },
                { text: "確定", style: "destructive", onPress: () => require("firebase/auth").signOut(auth) }
              ]);
            }}
          >
            <Text style={styles.logoutText}>登出</Text>
          </Pressable>
{/* 🎯 找到設定頁面裡的刪除帳號按鈕，換成這段： */}
<Pressable 
  style={styles.deleteButton} 
  onPress={() => {
    // 第一層防護：跳窗詢問
    Alert.alert(
      "危險操作", 
      "您確定要刪除帳號嗎？此操作將無法復原，且您所有的資料將會被永久抹除。", 
      [
        { text: "取消", style: "cancel" },
        { 
          text: "確定刪除", 
          style: "destructive", 
          onPress: async () => {
            try {
              // 呼叫 Firebase 刪除當前登入用戶
              await deleteUser(currentUser);
              Alert.alert("帳號已刪除", "您的帳號已成功抹除。");
              // 刪除成功後，onAuthStateChanged 會自動偵測到並把你送回 Login 頁
            } catch (error) {
              console.error("刪除帳號失敗:", error);
              if (error.code === "auth/requires-recent-login") {
                Alert.alert(
                  "驗證過期", 
                  "為了安全起見，刪除帳號前需要重新登入。請先登出並重新登入後再試。"
                );
              } else {
                Alert.alert("操作失敗", "目前無法刪除帳號，請稍後再試。");
              }
            }
          } 
        }
      ]
    );
  }}
>
  <Text style={styles.deleteText}>刪除帳號</Text>
</Pressable>
        </View>
      </View>
    );
  }


  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* 1. 頂部個人資訊 */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.avatarPlaceholder}>
            <Text style={{ fontSize: 40 }}>👤</Text>
          </View>
<Text style={styles.userName}>
  {currentUser.displayName || currentUser.email?.split('@')[0] || "使用者名稱"}
</Text>
        </View>
        <Pressable onPress={() => setCurrentView("settings")} style={styles.settingButton}>
          <Text style={{ fontSize: 24 }}>⚙️</Text>
        </Pressable>
      </View>

      {/* 2. 數據看板 */}
      <View style={styles.statsContainer}>
        <View style={[styles.statBox, styles.statDivider]}>
          {/* 顯示從 Firebase 計算出來的總數量 */}
          <Text style={styles.statNumber}>{userStats.reports}</Text>
          <Text style={styles.statLabel}>總回報數</Text>
        </View>
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
    backgroundColor: "#F9F9F9", // 配合圖片的淺灰底色
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
    backgroundColor: "#E0E0E0",
    alignItems: "center",
    justifyContent: "center",
  },
  userName: {
    fontSize: 22,
    fontWeight: "bold",
    marginLeft: 16,
    color: "#1A1A1A",
  },
  settingButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "#A3B7AC", // 圖片中的莫蘭迪綠
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 12,
    paddingVertical: 16,
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
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  statLabel: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 100, // 避免被底部導覽列遮擋
  },
  card: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
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
    fontSize: 24,
    marginBottom: 4,
  },
  cardTypeText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1A1A1A",
  },
  cardMiddle: {
    flex: 1,
    paddingHorizontal: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 4,
  },
  cardSubText: {
    fontSize: 12,
    color: "#888888",
    marginTop: 2,
  },
  cardRight: {
    justifyContent: "center",
  },
  arrow: {
    fontSize: 16,
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
    backgroundColor: "#E0E0E0",
    alignItems: "center",
    justifyContent: "center",
  },
  editAvatarText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#000000",
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#000000",
    marginLeft: 24,
    marginBottom: 8,
    marginTop: 16,
  },
  cardGroup: {
    backgroundColor: "#FFFFFF",
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
    fontSize: 18,
    marginRight: 12,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000000",
  },
  rowValue: {
    fontSize: 15,
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
    fontSize: 16,
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
    fontSize: 16,
    fontWeight: "bold",
  },
});
