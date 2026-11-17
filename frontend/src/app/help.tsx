// Help: the FAQs (tap a question to open the answer) and the support contact details.
// Both are managed in the admin panel (Content > FAQs, Content > Contact info).
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { api, getErrorMessage } from '@/lib/api';
import type { HelpData } from '@/lib/types';

async function open(url: string, what: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Could not open', `Your phone could not open ${what}.`);
  }
}

export default function HelpScreen() {
  const [openId, setOpenId] = useState<number | null>(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['help'],
    queryFn: async () => (await api.get<HelpData>('help/')).data,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.navy} />
      </View>
    );
  }
  if (isError || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>{getErrorMessage(error)}</Text>
        <Button title="Try again" variant="secondary" onPress={() => refetch()} style={styles.cta} />
      </View>
    );
  }

  const { contact, faqs } = data;
  const hasContact = !!(contact.support_email || contact.support_phone);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {hasContact && (
        <View style={styles.card}>
          <Text style={styles.heading} accessibilityRole="header">
            Contact us
          </Text>
          {contact.support_phone ? (
            <Pressable onPress={() => open(`tel:${contact.support_phone}`, 'the phone')} accessibilityRole="button" accessibilityLabel={`Call ${contact.support_phone}`} style={styles.contactRow}>
              <Ionicons name="call-outline" size={22} color={Colors.navy} />
              <Text style={styles.contactText}>{contact.support_phone}</Text>
              <Text style={styles.contactAction}>Call</Text>
            </Pressable>
          ) : null}
          {contact.support_email ? (
            <Pressable onPress={() => open(`mailto:${contact.support_email}`, 'your email app')} accessibilityRole="button" accessibilityLabel={`Email ${contact.support_email}`} style={styles.contactRow}>
              <Ionicons name="mail-outline" size={22} color={Colors.navy} />
              <Text style={styles.contactText}>{contact.support_email}</Text>
              <Text style={styles.contactAction}>Email</Text>
            </Pressable>
          ) : null}
          {contact.hours ? <Text style={styles.hours}>{contact.hours}</Text> : null}
        </View>
      )}

      <Text style={styles.sectionTitle} accessibilityRole="header">
        Frequently asked questions
      </Text>
      {faqs.length === 0 ? (
        <Text style={styles.message}>No questions yet.</Text>
      ) : (
        <View style={styles.card}>
          {faqs.map((faq, i) => {
            const isOpen = openId === faq.id;
            return (
              <View key={faq.id} style={[styles.faq, i > 0 && styles.faqBorder]}>
                <Pressable
                  onPress={() => setOpenId(isOpen ? null : faq.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                  style={styles.question}>
                  <Text style={styles.questionText}>{faq.question}</Text>
                  <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.textMuted} />
                </Pressable>
                {isOpen && <Text style={styles.answer}>{faq.answer}</Text>}
              </View>
            );
          })}
        </View>
      )}

      {!hasContact && <Text style={styles.footer}>Can&apos;t find your answer? Contact details will appear here soon.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, backgroundColor: Colors.background },
  message: { fontSize: FontSize.body, color: Colors.textMuted, textAlign: 'center' },
  cta: { marginTop: Spacing.lg, alignSelf: 'stretch' },
  card: { backgroundColor: Colors.white, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  heading: { fontSize: FontSize.title, fontWeight: '600', color: Colors.text, marginVertical: Spacing.sm },
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm + 2, borderTopWidth: 1, borderTopColor: Colors.border },
  contactText: { flex: 1, marginLeft: Spacing.md, fontSize: FontSize.body + 1, color: Colors.text },
  contactAction: { fontSize: FontSize.body, fontWeight: '700', color: Colors.navy },
  hours: { paddingVertical: Spacing.sm, fontSize: FontSize.body, color: Colors.textMuted },
  sectionTitle: { fontSize: FontSize.title, fontWeight: '600', color: Colors.text, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  faq: { paddingVertical: Spacing.xs },
  faqBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  question: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm + 2 },
  questionText: { flex: 1, marginRight: Spacing.sm, fontSize: FontSize.body + 1, fontWeight: '600', color: Colors.text },
  answer: { paddingBottom: Spacing.md, fontSize: FontSize.body, color: Colors.text, lineHeight: 21 },
  footer: { marginTop: Spacing.lg, textAlign: 'center', fontSize: FontSize.body, color: Colors.textMuted },
});
