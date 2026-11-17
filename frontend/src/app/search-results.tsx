// Search results: the same list as a category (sort, filters, grid), for the words that were searched.
import { useLocalSearchParams } from 'expo-router';

import { ProductListing } from '@/components/listing/product-listing';

export default function SearchResultsScreen() {
  const { q } = useLocalSearchParams<{ q: string }>();
  return <ProductListing key={q} scope={{ q }} fallbackTitle={`"${q ?? ''}"`} />;
}
