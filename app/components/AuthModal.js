import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { auth } from "../../firebase";

const mailIcon = require("../../assets/Mail.png");
const lockIcon = require("../../assets/Lock.png");

function getAuthErrorMessage(error) {
  switch (error?.code) {
    case "auth/email-already-in-use":
      return "這個電子郵件已經註冊過了。";
    case "auth/invalid-email":
      return "請輸入有效的電子郵件。";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "電子郵件或密碼不正確。";
    case "auth/weak-password":
      return "密碼至少需要 6 個字元。";
    default:
      return error?.message || "登入失敗，請稍後再試。";
  }
}

export default function AuthModal({
  googleError,
  isGoogleReady,
  isGoogleSigningIn,
  onClose,
  onGoogleSignIn,
  visible,
}) {
  const [mode, setMode] = useState("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [emailError, setEmailError] = useState("");
  const [googleAttempted, setGoogleAttempted] = useState(false);
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const insets = useSafeAreaInsets();
  const isSignUp = mode === "signUp";

  async function handleEmailSubmit() {
    const trimmedEmail = email.trim();
    const trimmedNickname = nickname.trim();

    setGoogleAttempted(false);

    if (!trimmedEmail || !password) {
      setEmailError("請輸入電子郵件和密碼。");
      return;
    }

    if (isSignUp && password !== confirmPassword) {
      setEmailError("兩次輸入的密碼不一致。");
      return;
    }

    setEmailError("");
    setIsEmailSubmitting(true);

    try {
      if (isSignUp) {
        const credential = await createUserWithEmailAndPassword(
          auth,
          trimmedEmail,
          password
        );

        if (trimmedNickname) {
          await updateProfile(credential.user, {
            displayName: trimmedNickname,
          });
        }
      } else {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
      }

      onClose();
    } catch (error) {
      setEmailError(getAuthErrorMessage(error));
    } finally {
      setIsEmailSubmitting(false);
    }
  }

  async function handleGooglePress() {
    setEmailError("");
    setGoogleAttempted(true);

    try {
      await onGoogleSignIn();
    } catch {
      // The hook exposes the error so it can be shown in this sheet.
    }
  }

  const isBusy = isEmailSubmitting || isGoogleSigningIn;

  return (
    <Modal animationType="fade" onRequestClose={onClose} visible={visible}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[styles.screen, { paddingTop: Math.max(insets.top, 22) }]}
      >
        <View style={styles.topRow}>
          <View style={styles.modeRow}>
            <ModeButton
              active={mode === "signIn"}
              label="登入"
              onPress={() => setMode("signIn")}
            />
            <ModeButton
              active={mode === "signUp"}
              label="註冊"
              onPress={() => setMode("signUp")}
            />
          </View>
          <Pressable
            accessibilityLabel="Close auth modal"
            accessibilityRole="button"
            hitSlop={12}
            onPress={onClose}
            style={styles.closeButton}
          >
            <Text style={styles.closeText}>x</Text>
          </Pressable>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>
            {isSignUp ? "建立新帳號" : "登入新帳號"}
          </Text>
          <Text style={styles.subtitle}>註冊帳號使用更多功能</Text>

          <AuthInput
            autoCapitalize="none"
            autoComplete="email"
            icon="email"
            keyboardType="email-address"
            label="電子郵件"
            onChangeText={setEmail}
            placeholder="請輸入電子郵件"
            value={email}
          />
          <AuthInput
            autoCapitalize="none"
            autoComplete={isSignUp ? "new-password" : "password"}
            icon="lock"
            label={isSignUp ? "設定密碼" : "密碼"}
            onChangeText={setPassword}
            placeholder="請設定至少 6 個字元的密碼"
            secureTextEntry
            value={password}
          />

          {isSignUp ? (
            <>
              <AuthInput
                autoCapitalize="none"
                autoComplete="new-password"
                icon="lock"
                label="確認密碼"
                onChangeText={setConfirmPassword}
                placeholder="請再次輸入密碼"
                secureTextEntry
                value={confirmPassword}
              />
              <AuthInput
                autoCapitalize="none"
                icon="user"
                label="帳號暱稱"
                onChangeText={setNickname}
                placeholder="請勿使用真名"
                value={nickname}
              />
            </>
          ) : null}

          {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={isBusy}
            onPress={handleEmailSubmit}
            style={[styles.primaryButton, isBusy ? styles.buttonDisabled : null]}
          >
            {isEmailSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {isSignUp ? "建立帳號" : "登入"}
              </Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={!isGoogleReady || isBusy}
            onPress={handleGooglePress}
            style={[
              styles.googleButton,
              !isGoogleReady || isBusy ? styles.buttonDisabled : null,
            ]}
          >
            {isGoogleSigningIn ? (
              <ActivityIndicator color="#222222" />
            ) : (
              <Text style={styles.googleButtonText}>或使用 Google 登入</Text>
            )}
          </Pressable>

          {googleAttempted && googleError ? (
            <Text style={styles.googleErrorText}>{googleError.message}</Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ModeButton({ active, label, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.modeButton, active ? styles.modeButtonActive : null]}
    >
      <Text style={[styles.modeText, active ? styles.modeTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function AuthInput({ icon, label, ...inputProps }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        <InputIcon name={icon} />
        <TextInput
          placeholderTextColor="#B8B8B8"
          style={styles.input}
          {...inputProps}
        />
      </View>
    </View>
  );
}

function InputIcon({ name }) {
  if (name === "email") {
    return <Image source={mailIcon} style={styles.emailIcon} />;
  }

  if (name === "user") {
    return (
      <View style={styles.userIcon}>
        <View style={styles.userHead} />
        <View style={styles.userBody} />
      </View>
    );
  }

  return <Image source={lockIcon} style={styles.lockIcon} />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F6F6F6",
  },
  topRow: {
    minHeight: 48,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  title: {
    color: "#000000",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 31,
  },
  subtitle: {
    marginTop: 3,
    color: "#B8B8B8",
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 21,
  },
  closeButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    color: "#000000",
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 26,
  },
  modeRow: {
    width: 176,
    height: 38,
    padding: 3,
    borderRadius: 9,
    backgroundColor: "#EBEBEB",
    flexDirection: "row",
  },
  modeButton: {
    flex: 1,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  modeButtonActive: {
    backgroundColor: "#AFC2B5",
  },
  modeText: {
    color: "#7E7E7E",
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20,
  },
  modeTextActive: {
    color: "#FFFFFF",
  },
  fieldGroup: {
    marginTop: 39,
  },
  fieldLabel: {
    color: "#000000",
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 26,
  },
  inputWrap: {
    height: 52,
    marginTop: 11,
    paddingLeft: 11,
    paddingRight: 13,
    borderWidth: 1,
    borderColor: "#B8B8B8",
    borderRadius: 8,
    backgroundColor: "#F6F6F6",
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    height: "100%",
    marginLeft: 14,
    color: "#000000",
    fontSize: 16,
    fontWeight: "900",
  },
  errorText: {
    marginTop: 14,
    color: "#D24A43",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  googleErrorText: {
    marginTop: 10,
    color: "#D24A43",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
    textAlign: "center",
  },
  primaryButton: {
    height: 49,
    marginTop: 40,
    borderRadius: 8,
    backgroundColor: "#AFC2B5",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 26,
  },
  googleButton: {
    height: 44,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#D6D6D6",
    borderRadius: 8,
    backgroundColor: "#F6F6F6",
    alignItems: "center",
    justifyContent: "center",
  },
  googleButtonText: {
    color: "#222222",
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 21,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  emailIcon: {
    width: 32,
    height: 32,
    resizeMode: "contain",
  },
  lockIcon: {
    width: 32,
    height: 32,
    resizeMode: "contain",
  },
  userIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
  },
  userHead: {
    width: 13,
    height: 13,
    borderWidth: 4,
    borderColor: "#B8B8B8",
    borderRadius: 7,
  },
  userBody: {
    width: 25,
    height: 14,
    marginTop: 2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderColor: "#B8B8B8",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
});
