// The Home tab. The sections come from the admin panel, in the admin's order.
// Shows: header, pincode bar, category strip, banners, the deal of the day, product rows, and "Recently viewed".
// Pull down to refresh; grey blocks show while it loads the first time.
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AnnouncementBar } from '@/components/home/announcement-bar';
import { BannerCarousel } from '@/components/home/banner-carousel';
import { Button } from '@/components/button';
import { CategoryStrip } from '@/components/home/category-strip';
import { DealSection } from '@/components/home/deal-section';
import { HomeHeader } from '@/components/home/home-header';
import { HomeSkeleton } from '@/components/home/home-skeleton';
import { PincodeBar } from '@/components/home/pincode-bar';
import { ProductRowSection } from '@/components/home/product-row-section';
import { RecentlyViewedRow } from '@/components/home/recently-viewed-row';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { api, getErrorMessage } from '@/lib/api';
import type { HomeResponse } from '@/lib/types';

export default function HomeScreen() {
  const { data, dataUpdatedAt, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['home'],
    queryFn: async () => (await api.get<HomeResponse>('home/')).data,
  });
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <View style={styles.container}>
      <HomeHeader />
      <PincodeBar />
      <AnnouncementBar messages={data?.announcements ?? []} speed={data?.announcement_speed} />

      {isLoading ? (
        <ScrollView scrollEnabled={false}>
          <HomeSkeleton />
        </ScrollView>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.message}>{getErrorMessage(error)}</Text>
          <Button title="Try again" variant="secondary" onPress={() => refetch()} style={styles.retry} />
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.navy]} tintColor={Colors.navy} />
          }>
          {data?.sections.map((section) => {
            switch (section.kind) {
              case 'category_strip':
                return <CategoryStrip key={section.id} categories={section.categories} />;
              case 'banner_carousel':
              case 'mid_banner':
                return <BannerCarousel key={section.id} banners={section.banners} />;
              case 'deal_of_day':
                return (
                  <DealSection
                    key={section.id}
                    title={section.title}
                    deal={section.deal}
                    receivedAt={dataUpdatedAt}
                    onExpired={() => refetch()}
                  />
                );
              case 'product_row':
                return (
                  <ProductRowSection
                    key={section.id}
                    title={section.title}
                    collection={section.collection}
                    products={section.products}
                    hasMore={section.has_more}
                  />
                );
              default:
                return null;
            }
          })}
          <RecentlyViewedRow />
          <View style={styles.bottomSpace} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  message: { fontSize: FontSize.body, color: Colors.textMuted, textAlign: 'center' },
  retry: { marginTop: Spacing.md, alignSelf: 'stretch' },
  bottomSpace: { height: Spacing.lg },
});
