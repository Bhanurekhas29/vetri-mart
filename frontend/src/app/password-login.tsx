// Log in with an email and password.
import { router } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/button';
import { FormError, FormScreen } from '@/components/form-screen';
import { TextField } from '@/components/text-field';
import { api, getErrorMessage } from '@/lib/api';
import { finishAuth, useAuth } from '@/lib/auth';
import type { AuthResponse } from '@/lib/types';

export default function PasswordLoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const login = async () => {
    if (loading) return; // a second tap or the keyboard's Enter key must not log in twice
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post<AuthResponse>('auth/login/', { email: email.trim().toLowerCase(), password });
      await signIn(data);
      finishAuth();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormScreen title="Welcome back" subtitle="Log in with your email and password.">
      <TextField
        label="Email address"
        value={email}
        onChangeText={setEmail}
        placeholder="name@email.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="Your password"
        secure
        autoComplete="password"
        onSubmitEditing={login}
      />
      <FormError message={error} />
      <Button title="Log in" onPress={login} loading={loading} />
      <Button title="Forgot password?" variant="link" onPress={() => router.push('/forgot-password')} />
      <Button title="Log in with a code instead" variant="link" onPress={() => router.back()} />
    </FormScreen>
  );
}
