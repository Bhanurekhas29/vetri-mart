// The shapes of the data the backend sends. They match the API docs page.

export type User = {
  id: number;
  email: string;
  name: string;
  phone: string;
  photo_url: string;
  email_order_updates: boolean;
  email_offers: boolean;
  has_password: boolean;
};

export type AuthResponse = {
  is_new_user: false | boolean;
  access: string;
  refresh: string;
  user: User;
};

// Returned by "verify code" when the email has no account yet.
export type NewUserResponse = {
  is_new_user: true;
  registration_token: string;
};

export type VerifyResponse = AuthResponse | NewUserResponse;

export type AddressLabel = 'home' | 'work' | 'other';

export type Address = {
  id: number;
  recipient_name: string;
  phone: string;
  pincode: string;
  address_line1: string;
  address_line2: string;
  landmark: string;
  city: string;
  state: string;
  label: AddressLabel;
  is_default: boolean;
};

// ---- Home page ----

export type ProductCard = {
  id: number;
  slug: string;
  name: string;
  brand: string | null;
  image: string | null;
  image_alt: string;
  price: string; // money arrives as text with two decimals, e.g. "1199.00"
  mrp: string;
  price_from: boolean; // the versions have different prices: show "From" before this (lowest) price
  discount_percent: number; // calculated by the server from MRP and price
  rating: number | null;
  rating_count: number;
  is_sponsored: boolean;
  in_stock: boolean;
};

export type CategoryTile = {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  icon_alt: string;
};

export type BannerTarget = { type: 'category' | 'product' | 'collection'; slug: string };

export type Banner = {
  id: number;
  title: string;
  image: string | null;
  alt_text: string;
  target: BannerTarget | null;
};

export type Deal = {
  id: number;
  name: string;
  ends_at: string;
  seconds_left: number;
  products: ProductCard[];
};

// Each Home section has a `kind`; only the fields that fit that kind are present.
export type HomeSection =
  | { id: number; kind: 'category_strip'; title: string; categories: CategoryTile[] }
  | { id: number; kind: 'banner_carousel' | 'mid_banner'; title: string; banners: Banner[] }
  | { id: number; kind: 'deal_of_day'; title: string; deal: Deal }
  | {
      id: number;
      kind: 'product_row';
      title: string;
      collection: { slug: string; name: string };
      products: ProductCard[];
      has_more: boolean;
    };

// `announcements` are the live messages for the moving line (empty = no line).
export type AnnouncementSpeed = 'slow' | 'normal' | 'fast';
export type HomeResponse = { announcements: string[]; announcement_speed: AnnouncementSpeed; sections: HomeSection[] };

// ---- Product detail page ----

export type ProductImage = { id: number; url: string | null; alt: string; colour_id: number | null };
export type ProductColour = { id: number; name: string; hex: string };
export type ProductSize = { id: number; name: string };

export type ProductVariant = {
  id: number;
  sku: string;
  colour_id: number | null;
  size_id: number | null;
  price: string;
  mrp: string;
  discount_percent: number; // calculated by the server
  stock: number;
  in_stock: boolean;
  stock_message: string; // "In stock", "Only 3 left" or "Out of stock"
};

export type Review = {
  id: number;
  name: string;
  rating: number;
  title: string;
  body: string;
  verified_purchase: boolean;
  created_at: string;
};

export type ProductQuestion = { id: number; question: string; answer: string };

export type BundleItem = {
  variant_id: number;
  product_slug: string;
  name: string;
  label: string;
  image: string | null;
  image_alt: string;
  price: string;
  quantity: number;
};

export type Bundle = {
  id: number;
  name: string;
  items: BundleItem[];
  bundle_price: string;
  total_price: string;
  saving: string;
  saving_percent: number;
};

export type ProductDetail = {
  id: number;
  slug: string;
  name: string;
  brand: { name: string; slug: string } | null;
  category: { name: string; slug: string; parent: { name: string; slug: string } | null };
  description: string;
  video_url: string;
  is_sponsored: boolean;
  rating: number | null;
  rating_count: number;
  rating_breakdown: Record<'5' | '4' | '3' | '2' | '1', number>;
  images: ProductImage[];
  colours: ProductColour[];
  sizes: ProductSize[];
  variants: ProductVariant[];
  default_variant_id: number;
  specifications: { name: string; value: string }[];
  reviews: Review[];
  questions: ProductQuestion[];
  bundles: Bundle[];
  similar: ProductCard[];
};

export type DeliveryCheck = {
  pincode: string;
  deliverable: boolean;
  days_min: number | null;
  days_max: number | null;
  message: string;
  delivery_fee: string;
  free_delivery_above: string;
};

// ---- Wishlist ----

export type WishlistItem = {
  product: ProductCard;
  saved_price: string;
  price_dropped: boolean; // today's lowest price is below the price when it was saved
  only_left: number | null; // set when the cheapest buyable version has 5 or fewer left
  single_variant_id: number | null; // set when the product has exactly one version
  added_at: string;
};

export type WishlistResponse = { count: number; items: WishlistItem[] };

// ---- Cart ----

export type CartIssue = 'unavailable' | 'out_of_stock' | 'low_stock' | null;

export type CartLine = {
  id: number;
  variant_id: number;
  product_slug: string;
  name: string;
  brand: string | null;
  label: string; // for example "Black / M"
  image: string | null;
  image_alt: string;
  quantity: number;
  price: string; // today's price
  mrp: string;
  discount_percent: number;
  line_total: string;
  stock: number;
  max_quantity: number;
  stock_message: string;
  low_stock: boolean; // 5 or fewer left
  issue: CartIssue; // set when this line blocks Place order
  price_dropped_from: string | null; // set when cheaper now than when it was added
};

export type CartSummary = {
  units: number;
  mrp_total: string;
  discount: string;
  subtotal: string;
  bundle_savings: string; // automatic "buy together" savings
  items_total: string; // price after bundle savings, before the coupon (delivery is judged on this)
  coupon_code: string; // '' when no coupon applies
  coupon_discount: string;
  delivery_fee: string;
  free_delivery_above: string;
  total: string;
  you_save: string;
};

export type CartCouponInfo = { code: string; valid: boolean; discount: string; message: string } | null;

export type AppliedBundle = { id: number; name: string; sets: number; saving_each: string; saving: string };

export type BundleSuggestion = {
  bundle_id: number;
  name: string;
  saving: string;
  missing: { variant_id: number; name: string; label: string; quantity: number; price: string; image: string | null; image_alt: string }[];
};

export type Cart = {
  items: CartLine[];
  saved_items: CartLine[]; // "Saved for later": not in the totals or the count
  missing?: number[]; // guest cart only: versions that no longer exist
  count: number; // every unit in the cart (the number on the cart icon)
  lines: number;
  summary: CartSummary;
  bundles: AppliedBundle[];
  bundle_suggestions: BundleSuggestion[];
  coupon: CartCouponInfo;
  can_checkout: boolean;
  blocking_lines: number;
};

export type AddToCartResult = Cart & {
  added: { variant_id: number; quantity: number; limited_by_stock: boolean; message: string };
};

export type OnboardingSlide = {
  id: number;
  title: string;
  subtitle: string;
  image: string | null; // full web address of the uploaded picture, or null when there is none
  alt_text: string; // typed in the admin; read out by screen readers
};

// ---- Product lists (category, collection, search) ----

export type CategoryInfo = {
  name: string;
  slug: string;
  main: { name: string; slug: string; children: { name: string; slug: string }[] };
};

export type SortOption = { value: string; label: string };

export type ListingPage = {
  count: number;
  page: number;
  next_page: number | null;
  category: CategoryInfo | null;
  collection: { name: string; slug: string } | null;
  sort: string;
  sorts: SortOption[];
  results: ProductCard[];
};

export type FilterOptions = {
  brands: { name: string; slug: string }[];
  colours: { id: number; name: string; hex: string }[];
  sizes: { id: number; name: string }[];
  price_min: string | null;
  price_max: string | null;
  discounts: number[];
};

export type CategoryNode = {
  id: number;
  name: string;
  slug: string;
  image: string | null;
  image_alt: string;
  children: { name: string; slug: string }[];
};

// ---- Notifications ----

export type AppNotification = {
  id: number;
  kind: 'order' | 'payment';
  title: string;
  message: string;
  order_id: number | null;
  order_number: string | null;
  is_read: boolean;
  created_at: string;
};

export type NotificationPage = { unread_count: number; next_page: number | null; results: AppNotification[] };

// ---- Checkout and orders ----

export type OrderStatus = 'pending_payment' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

export type OrderStep = { key: string; label: string; at: string | null; done: boolean; detail: string };

export type OrderItem = {
  name: string;
  colour: string;
  size: string;
  sku: string;
  image: string | null;
  price: string; // price paid per unit
  mrp: string;
  quantity: number;
  line_total: string;
  product_slug: string;
  can_review: boolean; // the order is delivered
  review: { id: number; rating: number } | null; // the shopper's own review of this product
};

export type Order = {
  id: number;
  order_number: string;
  status: OrderStatus;
  status_label: string;
  created_at: string;
  items: OrderItem[];
  address: { recipient_name: string; phone: string; pincode: string; address_line1: string; address_line2: string; landmark: string; city: string; state: string };
  price: { mrp_total: string; product_discount: string; subtotal: string; bundle_discount: string; coupon_code: string; coupon_discount: string; delivery_fee: string; total: string };
  timeline: OrderStep[];
  courier_name: string;
  tracking_number: string;
  payment: { status: string | null; method: string };
  delivery_estimate: string;
  is_refunded: boolean;
  refund_pending: boolean;
  can_pay: boolean;
  can_cancel: boolean;
  can_review: boolean;
  can_invoice: boolean;
};

export type CheckoutSummary = {
  items: { name: string; label: string; image: string | null; image_alt: string; quantity: number }[];
  summary: CartSummary;
  bundles: AppliedBundle[];
  coupon: CartCouponInfo;
  address: (Address & { landmark: string }) | null;
  delivery: { deliverable: boolean; days_min: number | null; days_max: number | null; message: string } | null;
  payments_ready: boolean;
  can_pay: boolean;
  blockers: string[];
};

export type OrderCard = {
  id: number;
  order_number: string;
  status: OrderStatus;
  status_label: string;
  created_at: string;
  total: string;
  first_item: string;
  more_items: number;
  image: string | null;
  can_pay: boolean;
  can_review: boolean;
  refund_pending: boolean;
  is_refunded: boolean;
};

export type OrderPage = { next_page: number | null; results: OrderCard[] };


// ---- Reviews written by the shopper ----

export type MyReviewInfo = {
  product: { slug: string; name: string; image: string | null; image_alt: string };
  can_review: boolean;
  message: string;
  review: { id: number; rating: number; title: string; body: string; created_at: string; updated_at: string; is_visible: boolean } | null;
};

export type MyReview = {
  id: number;
  rating: number;
  title: string;
  body: string;
  created_at: string;
  is_visible: boolean;
  product: { slug: string; name: string; image: string | null; image_alt: string };
};


// ---- Help and text pages ----

export type HelpData = {
  faqs: { id: number; question: string; answer: string }[];
  contact: { support_email: string; support_phone: string; hours: string };
};

export type StaticPage = { slug: string; title: string; body: string; updated_at: string };
