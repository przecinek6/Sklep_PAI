import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { ProductQuestion, ProductQuestionAnswer, UserProfile, Product } from '../../types/database.types';
import { Pagination } from '../Pagination';
import './QuestionManagement.css';

const ITEMS_PER_PAGE = 20;

interface QuestionWithDetails extends ProductQuestion {
  user_profiles?: UserProfile;
  products?: Product;
  answers?: (ProductQuestionAnswer & { user_profiles?: UserProfile })[];
}

export const QuestionManagement = () => {
  const [questions, setQuestions] = useState<QuestionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState<'unanswered' | 'answered' | 'all'>('unanswered');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [answerText, setAnswerText] = useState<Record<string, string>>({});
  const [submittingAnswer, setSubmittingAnswer] = useState<string | null>(null);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const goToPage = (page: number) => {
    setCurrentPage(page);
  };

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [currentPage, filter]);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  };

  const loadQuestions = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('product_questions')
        .select(`
          *,
          user_profiles (
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
        .order('created_at', { ascending: false });

      // Apply filter
      if (filter === 'unanswered') {
        query = query.eq('is_answered', false);
      } else if (filter === 'answered') {
        query = query.eq('is_answered', true);
      }

      // Apply pagination
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      // Load answers for each question
      if (data) {
        const questionsWithAnswers = await Promise.all(
          data.map(async (question) => {
            const { data: answers } = await supabase
              .from('product_question_answers')
              .select(`
                *,
                user_profiles (
                  id,
                  username,
                  first_name,
                  last_name
                )
              `)
              .eq('question_id', question.id)
              .order('created_at', { ascending: true });

            return { ...question, answers: answers || [] };
          })
        );

        setQuestions(questionsWithAnswers);
      }

      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error loading questions:', error);
      console.error('Błąd podczas ładowania pytań');
    } finally {
      setLoading(false);
    }
  };

  const sendQuestionEmail = async (
    question: QuestionWithDetails,
    answer: string
  ) => {
    if (!question.user_profiles?.email) {
      throw new Error('Brak adresu email użytkownika');
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Brak autoryzacji');
      }

      // Call Edge Function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-question-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            questionId: question.id,
            userId: question.user_id,
            productId: question.product_id,
            customerEmail: question.user_profiles.email,
            customerName: question.user_profiles.first_name || question.user_profiles.username,
            productName: question.products?.name,
            questionText: question.question,
            answerText: answer
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
    }
  };

  const handleSubmitAnswer = async (questionId: string) => {
    const answer = answerText[questionId]?.trim();
    if (!answer) {
      console.warn('Proszę wpisać odpowiedź');
      return;
    }

    setSubmittingAnswer(questionId);

    try {
      // Insert answer
      const { error } = await supabase
        .from('product_question_answers')
        .insert({
          question_id: questionId,
          user_id: currentUserId,
          answer: answer
        });

      if (error) throw error;

      // Send email notification
      const question = questions.find(q => q.id === questionId);
      if (question && question.user_profiles) {
        try {
          await sendQuestionEmail(question, answer);
        } catch (emailError) {
          console.error('Email error:', emailError);
          console.warn('Odpowiedź została dodana, ale wystąpił problem z wysłaniem emaila');
        }
      }

      // Clear answer text
      setAnswerText(prev => ({ ...prev, [questionId]: '' }));

      // Reload questions
      await loadQuestions();

      console.log('Odpowiedź została dodana');
    } catch (error) {
      console.error('Error submitting answer:', error);
      console.error('Błąd podczas dodawania odpowiedzi');
    } finally {
      setSubmittingAnswer(null);
    }
  };

  return (
    <div className="question-management">
      <div className="question-filters">
        <div className="filter-buttons">
          <button
            className={filter === 'unanswered' ? 'active' : ''}
            onClick={() => {
              setFilter('unanswered');
              goToPage(1);
            }}
          >
            Bez odpowiedzi ({filter === 'unanswered' ? totalCount : '...'})
          </button>
          <button
            className={filter === 'answered' ? 'active' : ''}
            onClick={() => {
              setFilter('answered');
              goToPage(1);
            }}
          >
            Z odpowiedzią
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
        <div className="loading">Ładowanie pytań...</div>
      ) : questions.length === 0 ? (
        <div className="no-data">
          {filter === 'unanswered' 
            ? 'Brak pytań bez odpowiedzi' 
            : 'Brak pytań do wyświetlenia'}
        </div>
      ) : (
        <>
          <div className="questions-list">
            {questions.map((question) => (
              <div key={question.id} className={`question-card ${!question.is_answered ? 'unanswered' : ''}`}>
                <div className="question-header">
                  <div className="question-author">
                    <strong>
                      {question.user_profiles?.first_name || question.user_profiles?.username || 'Użytkownik'}
                      {question.user_profiles?.last_name && ` ${question.user_profiles.last_name}`}
                    </strong>
                    <span className="question-email">{question.user_profiles?.email}</span>
                  </div>
                  <div className="question-meta">
                    <span className="question-date">
                      {new Date(question.created_at).toLocaleDateString('pl-PL')}
                    </span>
                    {!question.is_answered && (
                      <span className="badge-unanswered">Bez odpowiedzi</span>
                    )}
                    {question.is_answered && (
                      <span className="badge-answered">Odpowiedziano</span>
                    )}
                  </div>
                </div>

                <div className="question-product">
                  <strong>Produkt:</strong> {question.products?.name || 'Nieznany produkt'}
                </div>

                <div className="question-content">
                  <p><strong>Pytanie:</strong></p>
                  <p>{question.question}</p>
                </div>

                {question.answers && question.answers.length > 0 && (
                  <div className="answers-section">
                    <h4>Odpowiedzi ({question.answers.length}):</h4>
                    {question.answers.map((answer) => (
                      <div key={answer.id} className="answer-item">
                        <div className="answer-header">
                          <strong>
                            {answer.user_profiles?.first_name || answer.user_profiles?.username || 'Moderator'}
                            {answer.user_profiles?.last_name && ` ${answer.user_profiles.last_name}`}
                          </strong>
                          <span className="answer-date">
                            {new Date(answer.created_at).toLocaleDateString('pl-PL')}
                          </span>
                        </div>
                        <p className="answer-text">{answer.answer}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="answer-form">
                  <textarea
                    value={answerText[question.id] || ''}
                    onChange={(e) => setAnswerText(prev => ({ ...prev, [question.id]: e.target.value }))}
                    placeholder="Wpisz swoją odpowiedź..."
                    rows={4}
                    disabled={submittingAnswer === question.id}
                  />
                  <button
                    onClick={() => handleSubmitAnswer(question.id)}
                    className="btn-submit-answer"
                    disabled={!answerText[question.id]?.trim() || submittingAnswer === question.id}
                  >
                    {submittingAnswer === question.id ? 'Wysyłanie...' : 'Dodaj odpowiedź'}
                  </button>
                </div>
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

export default QuestionManagement;