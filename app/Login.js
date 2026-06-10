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
import { useRouter } from "expo-router";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { auth, db } from "../firebase";
import { colors, fontSizes } from "./constants/theme";

const mailIcon = require("../assets/mail.png");
const lockIcon = require("../assets/Lock.png");
const accountIcon = require("../assets/account_circle.png");

const authModes = {
  login: {
    title: "登入新帳號",
    subtitle: "登入帳號使用更多功能",
    actionText: "登入",
  },
  register: {
    title: "建立新帳號",
    subtitle: "註冊帳號使用更多功能",
    actionText: "建立帳號",
  },
};

function getAuthErrorMessage(error) {
  if (
    error?.message?.includes("Failed to create storage directory") ||
    error?.message?.includes("NSCocoaErrorDomain Code=512")
  ) {
    return "模擬器的本機儲存空間發生錯誤，請重新安裝 Expo Go 後再登入。";
  }

  switch (error.code) {
    case "auth/email-already-in-use":
      return "這個電子郵件已經註冊過，請直接登入。";
    case "auth/invalid-email":
      return "電子郵件格式不正確。";
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "電子郵件或密碼不正確。";
    case "auth/weak-password":
      return "密碼強度不足，請設定至少 6 個字元。";
    case "auth/network-request-failed":
      return "網路連線不穩，請稍後再試。";
    case "auth/too-many-requests":
      return "嘗試次數過多，請稍後再試。";
    case "auth/operation-not-allowed":
      return "Firebase 尚未啟用電子郵件/密碼登入。";
    case "auth/user-disabled":
      return "這個帳號已被停用，請聯絡管理員。";
    case "auth/invalid-api-key":
    case "auth/app-not-authorized":
      return "Firebase 登入設定有誤，請確認目前 App 的環境變數。";
    case "auth/internal-error":
      return "Firebase 登入服務暫時發生錯誤，請重新啟動 App 後再試。";
    default:
      return "目前無法完成登入，請稍後再試。";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState("login");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRegistering = mode === "register";

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace("/Account");
      }
    });
  }, [router]);

  function switchMode(nextMode) {
    if (isSubmitting) {
      return;
    }

    setMode(nextMode);
  }

  async function handleSubmit() {
    if (isSubmitting) {
      return;
    }

    const trimmedNickname = nickname.trim();
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      Alert.alert("資料未完成", "請輸入電子郵件與密碼。");
      return;
    }

    if (isRegistering && !trimmedNickname) {
      Alert.alert("資料未完成", "請輸入帳號暱稱。");
      return;
    }

    if (password.length < 6) {
      Alert.alert("密碼太短", "密碼請設定至少 6 個字元。");
      return;
    }

    if (isRegistering && password !== confirmPassword) {
      Alert.alert("密碼不一致", "請確認兩次輸入的密碼相同。");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isRegistering) {
        const credential = await createUserWithEmailAndPassword(
          auth,
          trimmedEmail,
          password
        );

        await updateProfile(credential.user, {
          displayName: trimmedNickname,
        });

        try {
          await setDoc(doc(db, "users", credential.user.uid), {
            id: credential.user.uid,
            nickname: trimmedNickname,
            email: trimmedEmail,
            createdAt: serverTimestamp(),
          });
        } catch (profileError) {
          console.warn("Failed to create user profile", profileError);
        }
      } else {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
      }

      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("登入失敗:", {
        code: error?.code,
        message: error?.message,
      });
      Alert.alert("登入失敗", getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor={colors.background}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 24) + 33,
            paddingBottom: Math.max(insets.bottom, 24) + 128,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.segmentedControl}>
          <AuthTab
            active={mode === "login"}
            label="登入"
            onPress={() => switchMode("login")}
          />
          <AuthTab
            active={mode === "register"}
            label="註冊"
            onPress={() => switchMode("register")}
          />
        </View>

        <View
          style={[
            styles.formHeader,
            isRegistering ? styles.registerHeader : styles.loginHeader,
          ]}
        >
          <Text style={styles.title}>{authModes[mode].title}</Text>
          <Text style={styles.subtitle}>{authModes[mode].subtitle}</Text>
        </View>

        <View style={styles.form}>
          {isRegistering ? (
            <FormField
              autoCapitalize="none"
              icon={accountIcon}
              label="帳號暱稱"
              onChangeText={setNickname}
              placeholder="請勿使用真名"
              textContentType="nickname"
              value={nickname}
            />
          ) : null}

          <FormField
            autoCapitalize="none"
            icon={mailIcon}
            keyboardType="email-address"
            label="電子郵件"
            onChangeText={setEmail}
            placeholder="請輸入電子郵件"
            textContentType="emailAddress"
            value={email}
          />

          <FormField
            icon={lockIcon}
            label={isRegistering ? "設定密碼" : "密碼"}
            onChangeText={setPassword}
            placeholder="請設定至少 6 個字元的密碼"
            secureTextEntry
            textContentType={isRegistering ? "newPassword" : "password"}
            value={password}
          />

          {isRegistering ? (
            <FormField
              icon={lockIcon}
              label="確認密碼"
              onChangeText={setConfirmPassword}
              placeholder="請再次輸入密碼"
              secureTextEntry
              textContentType="newPassword"
              value={confirmPassword}
            />
          ) : null}

          <Pressable
            accessibilityLabel={authModes[mode].actionText}
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={handleSubmit}
            style={[
              styles.submitButton,
              isSubmitting ? styles.submitButtonDisabled : null,
            ]}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? "處理中..." : authModes[mode].actionText}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function AuthTab({ active, label, onPress }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tab, active ? styles.tabActive : styles.tabInactive]}
    >
      <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function FormField({ icon, label, ...inputProps }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputBox}>
        <Image source={icon} style={styles.inputIcon} />
        <TextInput
          autoCorrect={false}
          placeholderTextColor={colors.special}
          style={styles.input}
          {...inputProps}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  segmentedControl: {
    width: 300,
    height: 30,
    alignSelf: "center",
    flexDirection: "row",
    backgroundColor: colors.white,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: {
    backgroundColor: colors.special,
  },
  tabInactive: {
    backgroundColor: colors.white,
  },
  tabText: {
    color: colors.special,
    fontSize: fontSizes.titleSmall,
    fontWeight: "900",
    lineHeight: 24,
  },
  tabTextActive: {
    color: colors.white,
  },
  formHeader: {
    marginTop: 45,
  },
  loginHeader: {
    marginBottom: 13,
  },
  registerHeader: {
    marginBottom: 13,
  },
  title: {
    color: colors.black,
    fontSize: fontSizes.heading,
    fontWeight: "900",
    lineHeight: 31,
  },
  subtitle: {
    marginTop: 1,
    color: colors.special,
    fontSize: fontSizes.bodyLarge,
    fontWeight: "900",
    lineHeight: 21,
  },
  form: {
    width: "100%",
  },
  fieldGroup: {
    marginTop: 29,
  },
  fieldLabel: {
    color: colors.black,
    fontSize: fontSizes.title,
    fontWeight: "900",
    lineHeight: 26,
  },
  inputBox: {
    height: 52,
    marginTop: 9,
    borderWidth: 1,
    borderColor: colors.special,
    borderRadius: 9,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
  },
  inputIcon: {
    width: 32,
    height: 32,
    marginLeft: 10,
    marginRight: 18,
    resizeMode: "contain",
    opacity: 0.78,
  },
  input: {
    flex: 1,
    height: "100%",
    paddingRight: 14,
    color: colors.black,
    fontSize: fontSizes.bodyLarge,
    fontWeight: "900",
    lineHeight: 22,
  },
  submitButton: {
    height: 49,
    marginTop: 39,
    borderRadius: 8,
    backgroundColor: colors.special,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: fontSizes.title,
    fontWeight: "900",
    lineHeight: 26,
  },
});
