// Step 2 of login: type the 6-digit code from the email.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { FormError, FormScreen } from '@/components/form-screen';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { api, getErrorMessage } from '@/lib/api';
import { finishAuth, useAuth } from '@/lib/auth';
import type { VerifyResponse } from '@/lib/types';

const RESEND_SECONDS = 30;

export default function OtpScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const { signIn } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  // The "resend" countdown.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const verify = async () => {
    setError('');
    setInfo('');
    if (code.length !== 6) {
      setError('Enter the 6-digit code.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post<VerifyResponse>('auth/otp/verify/', { email, code });
      if (data.is_new_user === true && 'registration_token' in data) {
        // A new email: ask for a name next. The account is created there.
        router.replace({ pathname: '/register', params: { token: data.registration_token } });
      } else if ('access' in data) {
        await signIn(data);
        finishAuth();
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError('');
    setInfo('');
    try {
      await api.post('auth/otp/send/', { email, purpose: 'login' });
      setCode('');
      setSecondsLeft(RESEND_SECONDS);
      setInfo('A new code is on its way.');
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <FormScreen title="Enter the code" subtitle={`We sent a 6-digit code to ${email}.`}>
      <TextInput
        value={code}
        onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus
        placeholder="------"
        placeholderTextColor={Colors.border}
        style={styles.codeInput}
        onSubmitEditing={verify}
        accessibilityLabel="6-digit code"
      />
      <FormError message={error} />
      {info ? <Text style={styles.info}>{info}</Text> : null}

      <Button title="Verify" onPress={verify} loading={loading} />

      <View style={styles.row}>
        {secondsLeft > 0 ? (
          <Text style={styles.timer}>Resend code in 00:{String(secondsLeft).padStart(2, '0')}</Text>
        ) : (
          <Button title="Resend code" variant="link" onPress={resend} />
        )}
        <Button title="Change email" variant="link" onPress={() => router.back()} />
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  codeInput: {
    fontSize: 28,
    letterSpacing: 14,
    textAlign: 'center',
    color: Colors.text,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  info: { fontSize: FontSize.body, color: Colors.success, marginBottom: Spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.md },
  timer: { fontSize: FontSize.body, color: Colors.textMuted },
});
