// "See all" of a Home row (a collection): the same list as a category, without sub-category chips.
import { useLocalSearchParams } from 'expo-router';

import { ProductListing } from '@/components/listing/product-listing';

export default function CollectionScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <ProductListing key={slug} scope={{ collection: slug }} fallbackTitle="Collection" />;
}
