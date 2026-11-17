// Questions and answers. Only questions the admin has answered are shown.
// A logged-in shopper can ask a new one; it appears here after the admin answers it in the admin panel.
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { api, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { ProductQuestion } from '@/lib/types';

export function QuestionsSection({ slug, questions }: { slug: string; questions: ProductQuestion[] }) {
  const { status } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [thanks, setThanks] = useState('');

  function ask() {
    if (status !== 'signedIn') {
      router.push('/login'); // asking needs an account
      return;
    }
    setError('');
    setOpen(true);
  }

  async function send() {
    const question = text.trim();
    if (question.length < 5) {
      setError('Please type your question (at least 5 characters).');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await api.post<{ detail: string }>(`products/${slug}/questions/`, { question });
      setThanks(res.data.detail);
      setText('');
      setOpen(false);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.section}>
      <Text style={styles.heading} accessibilityRole="header">
        Questions and answers
      </Text>

      {questions.length === 0 && <Text style={styles.empty}>No questions answered yet.</Text>}
      {questions.map((q) => (
        <View key={q.id} style={styles.item} accessible accessibilityLabel={`Question: ${q.question}. Answer: ${q.answer}`}>
          <Text style={styles.q}>Q: {q.question}</Text>
          <Text style={styles.a}>A: {q.answer}</Text>
        </View>
      ))}

      {thanks ? <Text style={styles.thanks}>{thanks}</Text> : null}
      <Button title="Ask a question" variant="secondary" onPress={ask} style={styles.askButton} />

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Ask a question</Text>
            <TextInput
              value={text}
              onChangeText={(v) => {
                setText(v.slice(0, 500));
                setError('');
              }}
              multiline
              placeholder="For example: Does it work with an iPhone?"
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
              accessibilityLabel="Your question"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button title="Send" onPress={send} loading={busy} style={styles.send} />
            <Pressable onPress={() => setOpen(false)} accessibilityRole="button" style={styles.cancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: Colors.white, marginTop: Spacing.sm, padding: Spacing.md },
  heading: { fontSize: FontSize.title, fontWeight: '600', color: Colors.text },
  empty: { marginTop: Spacing.sm, fontSize: FontSize.body, color: Colors.textMuted },
  item: { marginTop: Spacing.md },
  q: { fontSize: FontSize.body, fontWeight: '600', color: Colors.text },
  a: { fontSize: FontSize.body, color: Colors.text, marginTop: 2, lineHeight: 20 },
  thanks: { marginTop: Spacing.md, fontSize: FontSize.body, color: Colors.success },
  askButton: { marginTop: Spacing.md },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: Spacing.lg },
  card: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.lg },
  cardTitle: { fontSize: FontSize.title, fontWeight: '600', color: Colors.text, marginBottom: Spacing.md },
  input: {
    minHeight: 90,
    textAlignVertical: 'top',
    fontSize: FontSize.body,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.sm + 2,
  },
  error: { fontSize: FontSize.caption + 1, color: Colors.error, marginTop: Spacing.xs },
  send: { marginTop: Spacing.md },
  cancel: { alignItems: 'center', paddingTop: Spacing.md },
  cancelText: { fontSize: FontSize.body, color: Colors.navy, fontWeight: '500' },
});
