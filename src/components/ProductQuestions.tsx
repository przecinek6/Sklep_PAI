import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { ProductQuestion, ProductQuestionAnswer, UserProfile } from '../types/database.types';
import { MessageCircle, Send, AlertCircle } from 'lucide-react';
import './ProductQuestions.css';

interface ProductQuestionsProps {
  productId: string;
  currentUserId?: string;
  userRole?: string;
}

export const ProductQuestions = ({ productId, currentUserId, userRole }: ProductQuestionsProps) => {
  const [questions, setQuestions] = useState<ProductQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, ProductQuestionAnswer[]>>({});
  const [loading, setLoading] = useState(true);
  const [newQuestion, setNewQuestion] = useState('');
  const [answerTexts, setAnswerTexts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isModerator = userRole === 'moderator' || userRole === 'admin';

  useEffect(() => {
    loadQuestions();
  }, [productId]);

  const loadQuestions = async () => {
    try {
      setLoading(true);
      
      // Load questions
      const { data: questionsData, error: questionsError } = await supabase
        .from('product_questions')
        .select(`
          *,
          user_profiles (
            id,
            first_name,
            last_name,
            email,
            avatar_url
          )
        `)
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      if (questionsError) throw questionsError;

      setQuestions(questionsData || []);

      // Load all answers for these questions
      if (questionsData && questionsData.length > 0) {
        const questionIds = questionsData.map(q => q.id);
        
        const { data: answersData, error: answersError } = await supabase
          .from('product_question_answers')
          .select(`
            *,
            user_profiles (
              id,
              first_name,
              last_name,
              email,
              avatar_url,
              role
            )
          `)
          .in('question_id', questionIds)
          .order('created_at', { ascending: true });

        if (answersError) throw answersError;

        // Group answers by question_id
        const answersMap: Record<string, ProductQuestionAnswer[]> = {};
        answersData?.forEach(answer => {
          if (!answersMap[answer.question_id]) {
            answersMap[answer.question_id] = [];
          }
          answersMap[answer.question_id].push(answer);
        });

        setAnswers(answersMap);
      }
    } catch (err) {
      console.error('Error loading questions:', err);
      setError('Błąd podczas ładowania pytań');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId || !newQuestion.trim()) return;

    try {
      setError(null);
      setSuccess(null);

      const { error: insertError } = await supabase
        .from('product_questions')
        .insert({
          product_id: productId,
          user_id: currentUserId,
          question: newQuestion.trim(),
        });

      if (insertError) throw insertError;

      setSuccess('Pytanie zostało dodane');
      setNewQuestion('');
      await loadQuestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd podczas dodawania pytania');
    }
  };

  const handleSubmitAnswer = async (questionId: string) => {
    if (!currentUserId || !isModerator) return;

    const answerText = answerTexts[questionId]?.trim();
    if (!answerText) return;

    try {
      setError(null);

      const { error: insertError } = await supabase
        .from('product_question_answers')
        .insert({
          question_id: questionId,
          user_id: currentUserId,
          answer: answerText,
        });

      if (insertError) throw insertError;

      // Clear answer text
      setAnswerTexts({ ...answerTexts, [questionId]: '' });
      await loadQuestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd podczas dodawania odpowiedzi');
    }
  };

  const getUserDisplayName = (user?: UserProfile) => {
    if (!user) return 'Użytkownik';
    if (user.first_name || user.last_name) {
      return `${user.first_name || ''} ${user.last_name || ''}`.trim();
    }
    return user.email?.split('@')[0] || 'Użytkownik';
  };

  return (
    <div className="product-questions">
      <div className="questions-header">
        <h2>Pytania o produkt</h2>
        <p>Masz pytanie? Zadaj je, a nasz zespół postara się odpowiedzieć jak najszybciej.</p>
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

      {/* Question Form */}
      {currentUserId ? (
        <form className="question-form" onSubmit={handleSubmitQuestion}>
          <div className="form-group">
            <textarea
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Zadaj pytanie o produkt..."
              rows={3}
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={!newQuestion.trim()}>
            <Send size={18} />
            Wyślij pytanie
          </button>
        </form>
      ) : (
        <div className="login-prompt">
          <MessageCircle size={24} />
          <p>Zaloguj się, aby zadać pytanie</p>
        </div>
      )}

      {/* Questions List */}
      <div className="questions-list">
        {loading ? (
          <div className="questions-loading">Ładowanie pytań...</div>
        ) : questions.length === 0 ? (
          <div className="questions-empty">
            <MessageCircle size={48} />
            <p>Brak pytań o tym produkcie</p>
            <p className="text-secondary">Bądź pierwszy i zadaj pytanie!</p>
          </div>
        ) : (
          questions.map((question) => (
            <div key={question.id} className="question-card">
              <div className="question-header">
                <div className="question-author">
                  {question.user_profiles?.avatar_url ? (
                    <img src={question.user_profiles.avatar_url} alt="" className="author-avatar" />
                  ) : (
                    <div className="author-avatar-placeholder">
                      {getUserDisplayName(question.user_profiles)[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="author-name">{getUserDisplayName(question.user_profiles)}</div>
                    <span className="question-date">
                      {new Date(question.created_at).toLocaleDateString('pl-PL', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
                {question.is_answered && (
                  <span className="answered-badge">Odpowiedziano</span>
                )}
              </div>

              <div className="question-content">
                <MessageCircle size={20} className="question-icon" />
                <p>{question.question}</p>
              </div>

              {/* Answers */}
              {answers[question.id] && answers[question.id].length > 0 && (
                <div className="answers-section">
                  {answers[question.id].map((answer) => (
                    <div key={answer.id} className="answer-card">
                      <div className="answer-header">
                        <div className="answer-author">
                          {answer.user_profiles?.avatar_url ? (
                            <img src={answer.user_profiles.avatar_url} alt="" className="author-avatar-small" />
                          ) : (
                            <div className="author-avatar-placeholder-small">
                              {getUserDisplayName(answer.user_profiles)[0].toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="author-name">
                              {getUserDisplayName(answer.user_profiles)}
                              {(answer.user_profiles?.role === 'moderator' || answer.user_profiles?.role === 'admin') && (
                                <span className="moderator-badge">Moderator</span>
                              )}
                            </div>
                            <span className="answer-date">
                              {new Date(answer.created_at).toLocaleDateString('pl-PL', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="answer-content">{answer.answer}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Answer Form (for moderators) */}
              {isModerator && (
                <div className="answer-form">
                  <textarea
                    value={answerTexts[question.id] || ''}
                    onChange={(e) => setAnswerTexts({ ...answerTexts, [question.id]: e.target.value })}
                    placeholder="Napisz odpowiedź..."
                    rows={2}
                  />
                  <button
                    className="btn-secondary btn-small"
                    onClick={() => handleSubmitAnswer(question.id)}
                    disabled={!answerTexts[question.id]?.trim()}
                  >
                    <Send size={16} />
                    Odpowiedz
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
