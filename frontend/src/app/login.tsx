// The main login screen: enter an email and we send a code. Guests can skip it.
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { FormError } from '@/components/form-screen';
import { TextField } from '@/components/text-field';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { api, getErrorMessage, getFieldErrors } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const { completeEntry } = useAuth();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const sendCode = async () => {
    if (loading) return; // a second tap or the keyboard's Enter key must not open the code screen twice
    const value = email.trim().toLowerCase();
    setError('');
    if (!EMAIL_PATTERN.test(value)) {
      setEmailError('Enter a valid email address.');
      return;
    }
    setEmailError('');
    setLoading(true);
    try {
      await api.post('auth/otp/send/', { email: value, purpose: 'login' });
      router.push({ pathname: '/otp', params: { email: value } });
    } catch (e) {
      setEmailError(getFieldErrors(e).email ?? '');
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const continueAsGuest = async () => {
    await completeEntry();
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Text style={styles.brandText}>
              Vetri<Text style={styles.brandAccent}>Mart</Text>
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.title}>Log in or sign up</Text>
            <Text style={styles.subtitle}>We will email you a 6-digit code. No password needed.</Text>

            <TextField
              label="Email address"
              value={email}
              onChangeText={setEmail}
              placeholder="name@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              error={emailError}
              onSubmitEditing={sendCode}
            />
            <FormError message={emailError ? undefined : error} />

            <Button title="Send OTP" onPress={sendCode} loading={loading} />
            <Text style={styles.or}>or</Text>
            <Button title="Login with password" variant="secondary" onPress={() => router.push('/password-login')} />
            <Button title="Continue as guest" variant="link" onPress={continueAsGuest} style={styles.guest} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: Colors.navy },
  scroll: { flexGrow: 1 },
  brand: { alignItems: 'center', paddingVertical: Spacing.xl },
  brandText: { fontSize: 32, fontWeight: '700', color: Colors.white },
  brandAccent: { color: Colors.orange },
  form: {
    flex: 1,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.lg,
    minHeight: 420,
  },
  title: { fontSize: FontSize.heading, fontWeight: '600', color: Colors.text },
  subtitle: { fontSize: FontSize.body, color: Colors.textMuted, marginTop: Spacing.xs, marginBottom: Spacing.lg },
  or: { textAlign: 'center', color: Colors.textMuted, marginVertical: Spacing.md },
  guest: { marginTop: Spacing.md },
});
