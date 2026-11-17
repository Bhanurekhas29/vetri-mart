// A text page managed in the admin: Terms and conditions, Privacy policy, About Vetri Mart.
// In the admin text, a blank line starts a new paragraph and a line beginning with "# " is a heading.
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { isAxiosError } from 'axios';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { api, getErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { StaticPage } from '@/lib/types';

type Block = { kind: 'heading' | 'paragraph'; text: string };

function toBlocks(body: string): Block[] {
  return body
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part.startsWith('# ') ? { kind: 'heading', text: part.slice(2).trim() } : { kind: 'paragraph', text: part }));
}

export default function StaticPageScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['page', slug],
    enabled: !!slug,
    queryFn: async () => (await api.get<StaticPage>(`pages/${slug}/`)).data,
  });

  const header = <Stack.Screen options={{ title: data?.title ?? 'Vetri Mart' }} />;

  if (isLoading) {
    return (
      <View style={styles.center}>
        {header}
        <ActivityIndicator color={Colors.navy} />
      </View>
    );
  }
  if (isError || !data) {
    const missing = isAxiosError(error) && error.response?.status === 404;
    return (
      <View style={styles.center}>
        {header}
        <Text style={styles.message}>{missing ? 'This page is not available yet.' : getErrorMessage(error)}</Text>
        {!missing && <Button title="Try again" variant="secondary" onPress={() => refetch()} style={styles.cta} />}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {header}
      <Text style={styles.title} accessibilityRole="header">
        {data.title}
      </Text>
      {toBlocks(data.body).map((block, i) =>
        block.kind === 'heading' ? (
          <Text key={i} style={styles.heading} accessibilityRole="header">
            {block.text}
          </Text>
        ) : (
          <Text key={i} style={styles.paragraph}>
            {block.text}
          </Text>
        ),
      )}
      <Text style={styles.updated}>Last updated {formatDate(data.updated_at)}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, backgroundColor: Colors.background },
  message: { fontSize: FontSize.body, color: Colors.textMuted, textAlign: 'center' },
  cta: { marginTop: Spacing.lg, alignSelf: 'stretch' },
  title: { fontSize: FontSize.heading + 4, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  heading: { fontSize: FontSize.title, fontWeight: '600', color: Colors.text, marginTop: Spacing.lg, marginBottom: Spacing.xs },
  paragraph: { fontSize: FontSize.body + 1, color: Colors.text, lineHeight: 23, marginTop: Spacing.xs },
  updated: { marginTop: Spacing.xl, fontSize: FontSize.caption + 1, color: Colors.textMuted },
});
