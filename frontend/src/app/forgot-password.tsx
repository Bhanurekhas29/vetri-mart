// Reset a forgotten password: we email a code, then the user picks a new password.
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Button } from '@/components/button';
import { FormError, FormScreen } from '@/components/form-screen';
import { TextField } from '@/components/text-field';
import { api, getErrorMessage, getFieldErrors } from '@/lib/api';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const sendCode = async () => {
    setError('');
    const value = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(value)) {
      setFieldErrors({ email: 'Enter a valid email address.' });
      return;
    }
    setFieldErrors({});
    setLoading(true);
    try {
      await api.post('auth/otp/send/', { email: value, purpose: 'reset_password' });
      setEmail(value);
      setStep('reset');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    setError('');
    setLoading(true);
    try {
      await api.post('auth/password/reset/', { email, code, new_password: newPassword });
      Alert.alert('Password changed', 'Please log in with your new password.');
      router.back(); // back to the password login screen
    } catch (e) {
      setFieldErrors(getFieldErrors(e));
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  if (step === 'email') {
    return (
      <FormScreen title="Forgot your password?" subtitle="Enter your email and we will send you a code.">
        <TextField
          label="Email address"
          value={email}
          onChangeText={setEmail}
          placeholder="name@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          error={fieldErrors.email}
        />
        <FormError message={error} />
        <Button title="Send code" onPress={sendCode} loading={loading} />
      </FormScreen>
    );
  }

  return (
    <FormScreen title="Choose a new password" subtitle={`If ${email} has an account, we sent it a 6-digit code.`}>
      <TextField
        label="6-digit code"
        value={code}
        onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="123456"
        error={fieldErrors.code}
      />
      <TextField
        label="New password"
        value={newPassword}
        onChangeText={setNewPassword}
        secure
        placeholder="At least 8 characters, a letter and a number"
        error={fieldErrors.new_password}
      />
      <FormError message={Object.keys(fieldErrors).length > 0 ? undefined : error} />
      <Button title="Change password" onPress={resetPassword} loading={loading} />
      <Button title="Use a different email" variant="link" onPress={() => setStep('email')} />
    </FormScreen>
  );
}
