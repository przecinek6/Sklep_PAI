import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { ProductReview, ReviewVote, UserProfile } from '../types/database.types';
import { Star, ThumbsUp, ThumbsDown, Edit2, Trash2, AlertCircle } from 'lucide-react';
import './ProductReviews.css';

interface ProductReviewsProps {
  productId: string;
  currentUserId?: string;
}

export const ProductReviews = ({ productId, currentUserId }: ProductReviewsProps) => {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [userReview, setUserReview] = useState<ProductReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [editingReview, setEditingReview] = useState<ProductReview | null>(null);
  const [userVotes, setUserVotes] = useState<Record<string, ReviewVote>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadReviews();
    if (currentUserId) {
      loadUserReview();
      loadUserVotes();
    }
  }, [productId, currentUserId]);

  const loadReviews = async () => {
    try {
      const { data, error } = await supabase
        .from('product_reviews')
        .select(`
          *,
          user_profiles!product_reviews_user_id_fkey (
            id,
            first_name,
            last_name,
            email,
            avatar_url
          )
        `)
        .eq('product_id', productId)
        .eq('is_approved', true)
        .eq('is_deleted', false)
        .order('helpful_count', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (err) {
      console.error('Error loading reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUserReview = async () => {
    if (!currentUserId) return;

    try {
      const { data, error } = await supabase
        .from('product_reviews')
        .select('*')
        .eq('product_id', productId)
        .eq('user_id', currentUserId)
        .eq('is_deleted', false)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setUserReview(data);
    } catch (err) {
      console.error('Error loading user review:', err);
    }
  };

  const loadUserVotes = async () => {
    if (!currentUserId) return;

    try {
      const { data, error } = await supabase
        .from('review_votes')
        .select('*')
        .eq('user_id', currentUserId);

      if (error) throw error;
      
      const votesMap: Record<string, ReviewVote> = {};
      data?.forEach(vote => {
        votesMap[vote.review_id] = vote;
      });
      setUserVotes(votesMap);
    } catch (err) {
      console.error('Error loading user votes:', err);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) return;

    try {
      setError(null);
      setSuccess(null);

      if (!content.trim()) {
        setError('Treść opinii jest wymagana');
        return;
      }

      if (editingReview) {
        // Update existing review
        const { error: updateError } = await supabase
          .from('product_reviews')
          .update({
            rating,
            title: title.trim() || null,
            content: content.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingReview.id);

        if (updateError) throw updateError;
        setSuccess('Opinia została zaktualizowana. Czeka na ponowną akceptację moderatora.');
      } else {
        // Create new review
        const { error: insertError } = await supabase
          .from('product_reviews')
          .insert({
            product_id: productId,
            user_id: currentUserId,
            rating,
            title: title.trim() || null,
            content: content.trim(),
          });

        if (insertError) throw insertError;
        setSuccess('Opinia została dodana. Czeka na akceptację moderatora.');
      }

      // Reset form
      setRating(5);
      setTitle('');
      setContent('');
      setShowReviewForm(false);
      setEditingReview(null);
      
      // Reload reviews
      await loadUserReview();
      await loadReviews();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd podczas zapisywania opinii');
    }
  };

  const handleEditReview = (review: ProductReview) => {
    setEditingReview(review);
    setRating(review.rating);
    setTitle(review.title || '');
    setContent(review.content);
    setShowReviewForm(true);
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć swoją opinię?')) return;

    try {
      const { error } = await supabase
        .from('product_reviews')
        .update({ is_deleted: true })
        .eq('id', reviewId);

      if (error) throw error;

      setSuccess('Opinia została usunięta');
      await loadUserReview();
      await loadReviews();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd podczas usuwania opinii');
    }
  };

  const handleVote = async (reviewId: string, voteType: 'helpful' | 'not_helpful') => {
    if (!currentUserId) return;

    try {
      const existingVote = userVotes[reviewId];

      if (existingVote) {
        if (existingVote.vote_type === voteType) {
          // Remove vote
          const { error } = await supabase
            .from('review_votes')
            .delete()
            .eq('id', existingVote.id);

          if (error) throw error;

          const newVotes = { ...userVotes };
          delete newVotes[reviewId];
          setUserVotes(newVotes);
        } else {
          // Update vote
          const { error } = await supabase
            .from('review_votes')
            .update({ vote_type: voteType })
            .eq('id', existingVote.id);

          if (error) throw error;

          setUserVotes({
            ...userVotes,
            [reviewId]: { ...existingVote, vote_type: voteType }
          });
        }
      } else {
        // Create new vote
        const { data, error } = await supabase
          .from('review_votes')
          .insert({
            review_id: reviewId,
            user_id: currentUserId,
            vote_type: voteType,
          })
          .select()
          .single();

        if (error) throw error;

        setUserVotes({
          ...userVotes,
          [reviewId]: data
        });
      }

      // Reload reviews to get updated counts
      await loadReviews();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd podczas głosowania');
    }
  };

  const renderStars = (rating: number, interactive: boolean = false, onRate?: (rating: number) => void) => {
    return (
      <div className="stars">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={`star ${star <= rating ? 'filled' : ''} ${interactive ? 'interactive' : ''}`}
            onClick={() => interactive && onRate?.(star)}
            disabled={!interactive}
          >
            <Star size={interactive ? 24 : 16} fill={star <= rating ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>
    );
  };

  const getUserDisplayName = (user?: UserProfile) => {
    if (!user) return 'Użytkownik';
    if (user.first_name || user.last_name) {
      return `${user.first_name || ''} ${user.last_name || ''}`.trim();
    }
    return user.email?.split('@')[0] || 'Użytkownik';
  };

  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  return (
    <div className="product-reviews">
      <div className="reviews-header">
        <h2>Opinie klientów</h2>
        {reviews.length > 0 && (
          <div className="reviews-summary">
            <div className="average-rating">
              <span className="rating-value">{averageRating.toFixed(1)}</span>
              {renderStars(Math.round(averageRating))}
              <span className="reviews-count">({reviews.length} {reviews.length === 1 ? 'opinia' : 'opinii'})</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="message error-message">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {success && (
        <div className="message success-message">
          <AlertCircle size={20} />
          {success}
        </div>
      )}

      {/* User's own review */}
      {currentUserId && userReview && !userReview.is_approved && (
        <div className="user-review-pending">
          <div className="pending-badge">
            <AlertCircle size={16} />
            Twoja opinia czeka na akceptację moderatora
          </div>
          <div className="review-card own-review">
            <div className="review-header">
              {renderStars(userReview.rating)}
              {userReview.title && <h3>{userReview.title}</h3>}
            </div>
            <p className="review-content">{userReview.content}</p>
            <div className="review-footer">
              <span className="review-date">
                {new Date(userReview.created_at).toLocaleDateString('pl-PL')}
              </span>
              <div className="review-actions">
                <button
                  className="btn-icon"
                  onClick={() => handleEditReview(userReview)}
                  title="Edytuj opinię"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  className="btn-icon danger"
                  onClick={() => handleDeleteReview(userReview.id)}
                  title="Usuń opinię"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Review Form */}
      {currentUserId && !userReview?.is_approved && (
        <div className="review-form-section">
          {!showReviewForm ? (
            <button
              className="btn-primary"
              onClick={() => setShowReviewForm(true)}
            >
              {userReview ? 'Edytuj opinię' : 'Dodaj opinię'}
            </button>
          ) : (
            <form className="review-form" onSubmit={handleSubmitReview}>
              <h3>{editingReview ? 'Edytuj opinię' : 'Dodaj opinię'}</h3>
              
              <div className="form-group">
                <label>Ocena *</label>
                {renderStars(rating, true, setRating)}
              </div>

              <div className="form-group">
                <label htmlFor="review-title">Tytuł (opcjonalnie)</label>
                <input
                  id="review-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Podsumuj swoją opinię"
                  maxLength={200}
                />
              </div>

              <div className="form-group">
                <label htmlFor="review-content">Treść opinii *</label>
                <textarea
                  id="review-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Podziel się swoimi wrażeniami o produkcie..."
                  rows={5}
                  required
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  {editingReview ? 'Zapisz zmiany' : 'Dodaj opinię'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowReviewForm(false);
                    setEditingReview(null);
                    setRating(5);
                    setTitle('');
                    setContent('');
                  }}
                >
                  Anuluj
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {!currentUserId && (
        <div className="login-prompt">
          <p>Zaloguj się, aby dodać opinię</p>
        </div>
      )}

      {/* Reviews List */}
      <div className="reviews-list">
        {loading ? (
          <div className="reviews-loading">Ładowanie opinii...</div>
        ) : reviews.length === 0 ? (
          <div className="reviews-empty">
            <p>Brak opinii o tym produkcie</p>
            <p className="text-secondary">Bądź pierwszy i podziel się swoją opinią!</p>
          </div>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="review-card">
              <div className="review-header">
                <div className="review-author">
                  {review.user_profiles?.avatar_url ? (
                    <img src={review.user_profiles.avatar_url} alt="" className="author-avatar" />
                  ) : (
                    <div className="author-avatar-placeholder">
                      {getUserDisplayName(review.user_profiles)[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="author-name">{getUserDisplayName(review.user_profiles)}</div>
                    {renderStars(review.rating)}
                  </div>
                </div>
                <span className="review-date">
                  {new Date(review.created_at).toLocaleDateString('pl-PL')}
                </span>
              </div>

              {review.title && <h4 className="review-title">{review.title}</h4>}
              <p className="review-content">{review.content}</p>

              {currentUserId && review.user_id !== currentUserId && (
                <div className="review-votes">
                  <span className="votes-label">Czy ta opinia była pomocna?</span>
                  <div className="vote-buttons">
                    <button
                      className={`vote-button ${userVotes[review.id]?.vote_type === 'helpful' ? 'active' : ''}`}
                      onClick={() => handleVote(review.id, 'helpful')}
                    >
                      <ThumbsUp size={16} />
                      <span>{review.helpful_count}</span>
                    </button>
                    <button
                      className={`vote-button ${userVotes[review.id]?.vote_type === 'not_helpful' ? 'active' : ''}`}
                      onClick={() => handleVote(review.id, 'not_helpful')}
                    >
                      <ThumbsDown size={16} />
                      <span>{review.not_helpful_count}</span>
                    </button>
                  </div>
                </div>
              )}

              {!currentUserId && (review.helpful_count > 0 || review.not_helpful_count > 0) && (
                <div className="review-votes-display">
                  <ThumbsUp size={16} /> {review.helpful_count}
                  <ThumbsDown size={16} /> {review.not_helpful_count}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
