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

export interface ModeratorCategory {
  id: string;
  moderator_id: string;
  category_id: string;
  assigned_by?: string;
  assigned_at: string;
  categories?: Category;
  user_profiles?: UserProfile;
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
  parent_id?: string | null; // null = question, not null = answer
  content: string;
  is_answered: boolean;
  created_at: string;
  updated_at: string;
  user_profiles?: UserProfile;
}

// Type alias for backward compatibility
export type ProductQuestionAnswer = ProductQuestion;

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

export type EmailNotificationStatus = 'pending' | 'sent' | 'failed';
export type DeliveryMethod = 'in_app' | 'email' | 'both';
export type NotificationType = 
  | 'order_status'
  | 'order_cancelled'
  | 'payment_success'
  | 'payment_failed'
  | 'review_approved'
  | 'review_rejected'
  | 'question_answered'
  | 'report_response'
  | 'product_added'
  | 'system';

export interface Notification {
  id: string;
  user_id: string;
  notification_type: NotificationType;
  
  // Common fields
  title: string;
  message: string;
  link?: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
  
  // In-app notification fields
  is_read: boolean;
  read_at?: string | null;
  
  // Email notification fields
  delivery_method: DeliveryMethod;
  email_to?: string | null;
  email_subject?: string | null;
  email_body?: string | null;
  email_status?: EmailNotificationStatus | null;
  email_sent_at?: string | null;
  email_error_message?: string | null;
  email_retry_count: number;
}

// Type alias for backward compatibility
export type EmailNotification = Notification;
