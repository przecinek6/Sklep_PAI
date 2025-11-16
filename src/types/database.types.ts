export type UserRole = 'user' | 'moderator' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  phone?: string;
  street_address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  provider?: string;
  locale?: string;
  role: UserRole;
  is_banned: boolean;
  ban_reason?: string;
  banned_at?: string;
  banned_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Theme {
  id: string;
  name: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  is_active: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parent_id?: string;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  stock_quantity: number;
  category_id?: string;
  is_active: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  product_images?: ProductImage[];
}

export interface ProductImage {
  id: string;
  product_id: string;
  original_url: string;
  thumbnail_url?: string;
  medium_url?: string;
  large_url?: string;
  display_order: number;
  created_at?: string;
}

export interface CartItem {
  id: string;
  user_id?: string;
  session_id?: string;
  product_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
  products?: Product;
}

export interface LocalCartItem {
  product_id: string;
  quantity: number;
}

export interface UserPreferences {
  user_id: string;
  theme_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SliderTemplate {
  id: string;
  name: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SliderTemplateProduct {
  id: string;
  template_id: string;
  product_id: string;
  display_order: number;
  created_at?: string;
}

export interface AuthResponse {
  user: UserProfile | null;
  error: Error | null;
}

export type VoteType = 'helpful' | 'not_helpful';
export type ReportStatus = 'pending' | 'in_progress' | 'resolved' | 'rejected';

export interface ProductReview {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  title?: string;
  content: string;
  is_approved: boolean;
  approved_by?: string;
  approved_at?: string;
  is_deleted: boolean;
  helpful_count: number;
  not_helpful_count: number;
  created_at: string;
  updated_at: string;
  user_profiles?: UserProfile;
}

export interface ReviewVote {
  id: string;
  review_id: string;
  user_id: string;
  vote_type: VoteType;
  created_at: string;
}

export interface ProductQuestion {
  id: string;
  product_id: string;
  user_id: string;
  question: string;
  is_answered: boolean;
  created_at: string;
  updated_at: string;
  user_profiles?: UserProfile;
}

export interface ProductQuestionAnswer {
  id: string;
  question_id: string;
  user_id: string;
  answer: string;
  created_at: string;
  updated_at: string;
  user_profiles?: UserProfile;
}

export interface ProductReport {
  id: string;
  product_id: string;
  user_id: string;
  reason: string;
  status: ReportStatus;
  assigned_to?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
  user_profiles?: UserProfile;
  assigned_user?: UserProfile;
}

export interface ReportMessage {
  id: string;
  report_id: string;
  user_id: string;
  message: string;
  is_moderator_message: boolean;
  created_at: string;
  user_profiles?: UserProfile;
}

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'refunded';

export interface Order {
  id: string;
  user_id: string;
  order_number: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  total_amount: number;
  shipping_cost: number;
  shipping_address_street?: string;
  shipping_address_city?: string;
  shipping_address_postal_code?: string;
  shipping_address_country?: string;
  stripe_payment_intent_id?: string;
  created_at: string;
  updated_at: string;
  user_profiles?: UserProfile;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price: number;
  created_at: string;
  products?: Product;
}

export type EmailNotificationStatus = 'pending' | 'sent' | 'failed' | 'cancelled';
export type NotificationType = 
  | 'order_created'
  | 'order_status_changed'
  | 'order_cancelled'
  | 'payment_confirmed'
  | 'payment_failed'
  | 'review_approved'
  | 'review_rejected'
  | 'question_answered'
  | 'report_responded'
  | 'report_resolved';

export interface EmailNotification {
  id: string;
  user_id: string;
  notification_type: NotificationType;
  subject: string;
  body: string;
  email_to: string;
  status: EmailNotificationStatus;
  sent_at?: string;
  error_message?: string;
  retry_count: number;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}
