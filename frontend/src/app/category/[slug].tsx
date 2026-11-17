// A category's product list: sub-category chips, sort, filters, grid. The list itself is shared (see ProductListing).
import { useLocalSearchParams } from 'expo-router';

import { ProductListing } from '@/components/listing/product-listing';

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <ProductListing key={slug} scope={{ category: slug }} fallbackTitle="Category" />;
}
