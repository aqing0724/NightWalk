import { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const mailIcon = require("../assets/mail.png");

const modes = {
  login: {
    title: "登入新帳號",
    subtitle: "註冊帳號使用更多功能",
    passwordLabel: "密碼",
    passwordPlaceholder: "請設定至少 6 個字元的密碼",
    buttonLabel: "登入",
  },
  register: {
    title: "建立新帳號",
    subtitle: "註冊帳號使用更多功能",
    passwordLabel: "設定密碼",
    passwordPlaceholder: "請設定至少 6 個字元的密碼",
    buttonLabel: "建立帳號",
  },
};

export default function AccountPage() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState("login");
  const isRegistering = mode === "register";
  const copy = modes[mode];

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#F6F6F6" />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 34) + 44,
            paddingBottom: Math.max(insets.bottom, 26) + 128,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.modeSwitch}>
          <Pressable
            accessibilityLabel="切換為登入"
            accessibilityRole="button"
            onPress={() => setMode("login")}
            style={[
              styles.modeButton,
              mode === "login" ? styles.modeButtonActive : null,
            ]}
          >
            <Text
              style={[
                styles.modeButtonText,
                mode === "login" ? styles.modeButtonTextActive : null,
              ]}
            >
              登入
            </Text>
          </Pressable>

          <Pressable
            accessibilityLabel="切換為註冊"
            accessibilityRole="button"
            onPress={() => setMode("register")}
            style={[
              styles.modeButton,
              mode === "register" ? styles.modeButtonActive : null,
            ]}
          >
            <Text
              style={[
                styles.modeButtonText,
                mode === "register" ? styles.modeButtonTextActive : null,
              ]}
            >
              註冊
            </Text>
          </Pressable>
        </View>

        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.subtitle}>{copy.subtitle}</Text>

        <FormField
          autoCapitalize="none"
          autoComplete="email"
          icon="mail"
          keyboardType="email-address"
          label="電子郵件"
          placeholder="請輸入電子郵件"
          textContentType="emailAddress"
        />

        <FormField
          autoComplete={isRegistering ? "new-password" : "password"}
          icon="lock"
          label={copy.passwordLabel}
          placeholder={copy.passwordPlaceholder}
          secureTextEntry
          textContentType={isRegistering ? "newPassword" : "password"}
        />

        {isRegistering ? (
          <>
            <FormField
              autoComplete="new-password"
              icon="lock"
              label="確認密碼"
              placeholder="請再次輸入密碼"
              secureTextEntry
              textContentType="newPassword"
            />

            <FormField
              autoCapitalize="none"
              autoComplete="username"
              icon="user"
              label="帳號暱稱"
              placeholder="請勿使用真名"
              textContentType="username"
            />
          </>
        ) : null}

        <Pressable
          accessibilityLabel={copy.buttonLabel}
          accessibilityRole="button"
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>{copy.buttonLabel}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function FormField({ icon, label, placeholder, ...inputProps }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <FieldIcon type={icon} />
        <TextInput
          accessibilityLabel={label}
          placeholder={placeholder}
          placeholderTextColor="#B9B9B9"
          style={styles.input}
          {...inputProps}
        />
      </View>
    </View>
  );
}

function FieldIcon({ type }) {
  if (type === "mail") {
    return <Image source={mailIcon} style={styles.mailIcon} />;
  }

  if (type === "user") {
    return (
      <View style={styles.userIcon}>
        <View style={styles.userHead} />
        <View style={styles.userShoulders} />
      </View>
    );
  }

  return (
    <View style={styles.lockIcon}>
      <View style={styles.lockShackle} />
      <View style={styles.lockBody} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F6F6F6",
  },
  content: {
    paddingHorizontal: 20,
  },
  modeSwitch: {
    width: "66.666%",
    height: 31,
    alignSelf: "center",
    marginBottom: 53,
    borderWidth: 1,
    borderColor: "#B9B9B9",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
  },
  modeButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modeButtonActive: {
    backgroundColor: "#AFC2B5",
  },
  modeButtonText: {
    color: "#B9B9B9",
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 21,
  },
  modeButtonTextActive: {
    color: "#FFFFFF",
  },
  title: {
    color: "#000000",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 31,
  },
  subtitle: {
    marginTop: 2,
    color: "#B9B9B9",
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 21,
  },
  field: {
    marginTop: 40,
  },
  label: {
    color: "#000000",
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 26,
  },
  inputWrap: {
    height: 52,
    marginTop: 10,
    paddingLeft: 12,
    paddingRight: 16,
    borderWidth: 1,
    borderColor: "#B9B9B9",
    borderRadius: 9,
    backgroundColor: "#F6F6F6",
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    minWidth: 0,
    marginLeft: 16,
    paddingVertical: 0,
    color: "#000000",
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 21,
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
  mailIcon: {
    width: 30,
    height: 30,
    resizeMode: "contain",
  },
  lockIcon: {
    width: 30,
    height: 32,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  lockShackle: {
    position: "absolute",
    top: 0,
    width: 18,
    height: 18,
    borderWidth: 4,
    borderBottomWidth: 0,
    borderColor: "#B9B9B9",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  lockBody: {
    width: 28,
    height: 20,
    borderWidth: 4,
    borderColor: "#B9B9B9",
    borderRadius: 3,
    backgroundColor: "#F6F6F6",
  },
  userIcon: {
    width: 30,
    height: 30,
    alignItems: "center",
  },
  userHead: {
    width: 11,
    height: 11,
    borderWidth: 4,
    borderColor: "#B9B9B9",
    borderRadius: 6,
  },
  userShoulders: {
    width: 24,
    height: 14,
    marginTop: 3,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderColor: "#B9B9B9",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
});
