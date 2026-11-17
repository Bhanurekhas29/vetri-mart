// Set a first password (for accounts that use codes) or change the current one.
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Button } from '@/components/button';
import { FormError, FormScreen } from '@/components/form-screen';
import { TextField } from '@/components/text-field';
import { api, getErrorMessage, getFieldErrors } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function SetPasswordScreen() {
  const { user, refreshUser } = useAuth();
  const hasPassword = user?.has_password ?? false;
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setError('');
    setLoading(true);
    try {
      await api.post('auth/password/set/', { current_password: current, new_password: next });
      await refreshUser();
      Alert.alert('Saved', hasPassword ? 'Your password was changed.' : 'Your password is set.');
      router.back();
    } catch (e) {
      setFieldErrors(getFieldErrors(e));
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormScreen
      title={hasPassword ? 'Change password' : 'Set a password'}
      subtitle={hasPassword ? undefined : 'Then you can log in with your email and password as well as with a code.'}>
      {hasPassword && (
        <TextField
          label="Current password"
          value={current}
          onChangeText={setCurrent}
          secure
          error={fieldErrors.current_password}
        />
      )}
      <TextField
        label="New password"
        value={next}
        onChangeText={setNext}
        secure
        placeholder="At least 8 characters, a letter and a number"
        error={fieldErrors.new_password}
      />
      <FormError message={Object.keys(fieldErrors).length > 0 ? undefined : error} />
      <Button title="Save password" onPress={save} loading={loading} />
    </FormScreen>
  );
}
