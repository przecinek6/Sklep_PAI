import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { ProductReview, UserProfile, Product } from '../../types/database.types';
import { Pagination } from '../Pagination';
import './ReviewModeration.css';

const ITEMS_PER_PAGE = 20;

interface ReviewWithDetails extends ProductReview {
  user_profiles?: UserProfile;
  products?: Product;
  approved_by_profile?: UserProfile;
}

export const ReviewModeration = () => {
  const [reviews, setReviews] = useState<ReviewWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'all'>('pending');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const goToPage = (page: number) => {
    setCurrentPage(page);
  };

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    loadReviews();
  }, [currentPage, filter]);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  };

  const loadReviews = async () => {
    try {
      setLoading(true);
      
      // FIXED: Jawnie określ nazwy relacji używając aliasów
      let query = supabase
        .from('product_reviews')
        .select(`
          *,
          user_profiles!product_reviews_user_id_fkey (
            id,
            email,
            username,
            first_name,
            last_name
          ),
          products (
            id,
            name,
            slug
          )
        `, { count: 'exact' })
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      // Apply filter
      if (filter === 'pending') {
        query = query.eq('is_approved', false);
      } else if (filter === 'approved') {
        query = query.eq('is_approved', true);
      }

      // Apply pagination
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      setReviews(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error loading reviews:', error);
      // alert('Błąd podczas ładowania opinii');
    } finally {
      setLoading(false);
    }
  };

  const sendReviewEmail = async (
    review: ReviewWithDetails,
    approved: boolean
  ) => {
    if (!review.user_profiles?.email) {
      throw new Error('Brak adresu email użytkownika');
    }

    setSendingEmail(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Brak autoryzacji');
      }

      // Call Edge Function (będzie trzeba stworzyć nową funkcję lub rozszerzyć istniejącą)
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-review-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            reviewId: review.id,
            userId: review.user_id,
            productId: review.product_id,
            customerEmail: review.user_profiles.email,
            customerName: review.user_profiles.first_name || review.user_profiles.username,
            productName: review.products?.name,
            approved: approved
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Nie udało się wysłać emaila');
      }

      console.log('Email sent successfully:', result);
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    } finally {
      setSendingEmail(false);
    }
  };

  const approveReview = async (reviewId: string) => {
    try {
      const { error } = await supabase
        .from('product_reviews')
        .update({
          is_approved: true,
          approved_by: currentUserId,
          approved_at: new Date().toISOString()
        })
        .eq('id', reviewId);

      if (error) throw error;

      // Send email notification
      const review = reviews.find(r => r.id === reviewId);
      if (review && review.user_profiles) {
        try {
          await sendReviewEmail(review, true);
        } catch (emailError) {
          console.error('Email error:', emailError);
          console.warn('Opinia została zaakceptowana, ale wystąpił problem z wysłaniem emaila');
        }
      }

      await loadReviews();
      console.log('Opinia została zaakceptowana');
    } catch (error) {
      console.error('Error approving review:', error);
      console.error('Błąd podczas akceptowania opinii');
    }
  };

  const rejectReview = async (reviewId: string) => {
    if (!confirm('Czy na pewno chcesz odrzucić tę opinię? Zostanie ona usunięta.')) {
      return;
    }

    try {
      const review = reviews.find(r => r.id === reviewId);
      
      const { error } = await supabase
        .from('product_reviews')
        .update({ is_deleted: true })
        .eq('id', reviewId);

      if (error) throw error;

      // Send email notification
      if (review && review.user_profiles) {
        try {
          await sendReviewEmail(review, false);
        } catch (emailError) {
          console.error('Email error:', emailError);
          console.warn('Opinia została odrzucona, ale wystąpił problem z wysłaniem emaila');
        }
      }

      await loadReviews();
      console.log('Opinia została odrzucona');
    } catch (error) {
      console.error('Error rejecting review:', error);
      console.error('Błąd podczas odrzucania opinii');
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="stars-display">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={star <= rating ? 'star-filled' : 'star-empty'}
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="review-moderation">
      <div className="review-filters">
        <div className="filter-buttons">
          <button
            className={filter === 'pending' ? 'active' : ''}
            onClick={() => {
              setFilter('pending');
              goToPage(1);
            }}
          >
            Oczekujące ({filter === 'pending' ? totalCount : '...'})
          </button>
          <button
            className={filter === 'approved' ? 'active' : ''}
            onClick={() => {
              setFilter('approved');
              goToPage(1);
            }}
          >
            Zaakceptowane
          </button>
          <button
            className={filter === 'all' ? 'active' : ''}
            onClick={() => {
              setFilter('all');
              goToPage(1);
            }}
          >
            Wszystkie
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">Ładowanie opinii...</div>
      ) : reviews.length === 0 ? (
        <div className="no-data">
          {filter === 'pending' 
            ? 'Brak opinii oczekujących na akceptację' 
            : 'Brak opinii do wyświetlenia'}
        </div>
      ) : (
        <>
          <div className="reviews-list">
            {reviews.map((review) => (
              <div key={review.id} className={`review-card ${!review.is_approved ? 'pending' : ''}`}>
                <div className="review-header">
                  <div className="review-author">
                    <strong>
                      {review.user_profiles?.first_name || review.user_profiles?.username || 'Użytkownik'}
                      {review.user_profiles?.last_name && ` ${review.user_profiles.last_name}`}
                    </strong>
                    <span className="review-email">{review.user_profiles?.email}</span>
                  </div>
                  <div className="review-meta">
                    <span className="review-date">
                      {new Date(review.created_at).toLocaleDateString('pl-PL')}
                    </span>
                    {!review.is_approved && (
                      <span className="badge-pending">Oczekuje</span>
                    )}
                    {review.is_approved && (
                      <span className="badge-approved">Zaakceptowana</span>
                    )}
                  </div>
                </div>

                <div className="review-product">
                  <strong>Produkt:</strong> {review.products?.name || 'Nieznany produkt'}
                </div>

                <div className="review-rating">
                  {renderStars(review.rating)}
                  <span className="rating-number">{review.rating}/5</span>
                </div>

                {review.title && (
                  <h3 className="review-title">{review.title}</h3>
                )}

                <p className="review-content">{review.content}</p>

                <div className="review-stats">
                  <span className="helpful-stat">
                    👍 Pomocne: {review.helpful_count}
                  </span>
                  <span className="not-helpful-stat">
                    👎 Niepomocne: {review.not_helpful_count}
                  </span>
                </div>

                {!review.is_approved && (
                  <div className="review-actions">
                    <button
                      onClick={() => approveReview(review.id)}
                      className="btn-approve"
                      disabled={sendingEmail}
                    >
                      ✓ Zaakceptuj
                    </button>
                    <button
                      onClick={() => rejectReview(review.id)}
                      className="btn-reject"
                      disabled={sendingEmail}
                    >
                      ✗ Odrzuć
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={goToPage}
          />
        </>
      )}
    </div>
  );
};

export default ReviewModeration;