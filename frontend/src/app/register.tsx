// Step 3 for brand-new emails: a name (required) and an optional password. The account is created here.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/button';
import { FormError, FormScreen } from '@/components/form-screen';
import { TextField } from '@/components/text-field';
import { api, getErrorCode, getErrorMessage, getFieldErrors } from '@/lib/api';
import { finishAuth, useAuth } from '@/lib/auth';
import type { AuthResponse } from '@/lib/types';

export default function RegisterScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { signIn } = useAuth();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const createAccount = async () => {
    setError('');
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'Enter your name.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      const { data } = await api.post<AuthResponse>('auth/register/', {
        registration_token: token,
        name: name.trim(),
        password,
      });
      await signIn(data);
      finishAuth();
    } catch (e) {
      setFieldErrors(getFieldErrors(e));
      const code = getErrorCode(e);
      if (code === 'registration_expired') {
        setError('Your sign-up session expired. Please start again.');
        setTimeout(() => router.replace('/login'), 1500);
      } else if (code !== 'validation_error') {
        setError(getErrorMessage(e));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormScreen title="Tell us your name" subtitle="Your email is verified. One last step to create your account.">
      <TextField
        label="Full name"
        value={name}
        onChangeText={setName}
        placeholder="Your name"
        autoCapitalize="words"
        autoComplete="name"
        error={fieldErrors.name}
      />
      <TextField
        label="Password (optional)"
        value={password}
        onChangeText={setPassword}
        placeholder="At least 8 characters, a letter and a number"
        secure
        hint="So you can log in without a code next time. You can skip this."
        error={fieldErrors.password}
      />
      <FormError message={error} />
      <Button title="Create account" onPress={createAccount} loading={loading} />
    </FormScreen>
  );
}
