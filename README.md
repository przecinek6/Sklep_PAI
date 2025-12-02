# Sklep PAI

## Opis projektu

Tech Shop to sklep internetowy. Aplikacja oferuje intuicyjny interfejs dla klientów do przeglądania katalogu produktów z systemem kategorii i podkategorii, składania zamówień oraz zarządzania swoim kontem. System wyposażony jest w rozbudowany panel administracyjny pozwalający na zarządzanie produktami, kategoriami, motywami kolorystycznymi oraz monitorowanie zamówień. Moderatorzy mogą zarządzać opiniami użytkowników, odpowiadać na pytania dotyczące produktów oraz obsługiwać zgłoszenia. Platforma integruje się z Supabase jako backendem, wykorzystuje autentykację OAuth (Google, GitHub), system płatności Stripe oraz automatyczne powiadomienia email poprzez Resend. Aplikacja jest w pełni responsywna i zabezpieczona przed atakami SQL Injection.

## Wykorzystane technologie

### Frontend
- React 18
- TypeScript
- Vite
- Lucide React

### Backend
- Supabase (BaaS - Backend as a Service)
- PostgreSQL (baza danych)
- Supabase Edge Functions
- Resend (wysyłka emaili)
- Stripe (płatności online)
- OAuth 2.0 (Google, GitHub)

## Wymagania funkcjonalne

1. **System autentykacji i autoryzacji**
   - Logowanie i rejestracja użytkowników
   - Autentykacja OAuth (Google, GitHub)
   - Role użytkowników (użytkownik, moderator, administrator)

2. **Zarządzanie produktami**
   - Przeglądanie katalogu produktów z paginacją
   - System kategorii i podkategorii (breadcrumbs)
   - Wyszukiwanie produktów
   - Szczegółowe strony produktów ze zdjęciami
   - Slider wyróżnionych produktów na stronie głównej

3. **Koszyk i zamówienia**
   - Dodawanie produktów do koszyka
   - Kumulacja identycznych produktów
   - Składanie zamówień z danymi wysyłkowymi
   - Historia zamówień użytkownika z filtrowaniem
   - Anulowanie zamówień

4. **Panel administratora**
   - Zarządzanie motywami kolorystycznymi (3 kolory podstawowe)
   - Zarządzanie kategoriami i podkategoriami produktów
   - Dodawanie/edycja produktów z edytorem HTML
   - Upload zdjęć metodą drag-and-drop z możliwością zmiany kolejności
   - Automatyczne skalowanie zdjęć (thumbnail, medium, original)

5. **Panel moderatora**
   - Zarządzanie produktami
   - Akceptacja i moderacja opinii użytkowników
   - Odpowiadanie na pytania użytkowników
   - Obsługa zgłoszeń użytkowników
   - Zarządzanie zamówieniami (zmiana statusu, anulowanie)

6. **Panel użytkownika**
   - Zarządzanie danymi osobowymi i adresowymi
   - Historia zamówień
   - Personalizacja wyglądu (wybór motywu)
   - Zarządzanie kontami OAuth
   - Usuwanie konta

7. **System opinii i pytań**
   - Dodawanie opinii do produktów (z akceptacją moderatora)
   - Ocenianie opinii innych użytkowników (helpful/not helpful)
   - Zadawanie pytań do produktów
   - Zgłaszanie produktów do moderatora z możliwością dyskusji

8. **System powiadomień**
   - Powiadomienia email o statusie zamówienia
   - Powiadomienia w aplikacji dla użytkowników/moderatorów
   - Powiadomienia o nowych opiniach, pytaniach, zgłoszeniach

9. **Płatności**
   - Integracja z Stripe (tryb sandbox)
   - Automatyczna aktualizacja statusu zamówienia po płatności

## Wymagania niefunkcjonalne

1. **Bezpieczeństwo**
   - Ochrona przed SQL Injection poprzez wykorzystanie Supabase RLS (Row Level Security)
   - Zabezpieczone API poprzez polityki dostępu Supabase
   - Hashowanie haseł
   - Walidacja danych po stronie klienta i serwera

2. **Responsywność**
   - Pełna responsywność na urządzeniach mobilnych, tabletach i desktopach
   - Adaptacyjny układ (tabele → karty na mobile)
   - Responsywny slider (5 → 4 → 3 → 2 → 1 produkt)

3. **Wydajność**
   - Automatyczne skalowanie zdjęć (thumbnail, medium, original)
   - Lazy loading obrazów
   - Paginacja list (produkty, zamówienia, opinie)
   - Optymalizacja zapytań do bazy danych

4. **Użyteczność**
   - Intuicyjny interfejs użytkownika
   - Podgląd zmian na żywo (preview motywów)
   - Zachowanie stanu formularzy po błędach
   - Informacje zwrotne dla użytkownika (komunikaty sukcesu/błędu)

5. **Skalowalność**
   - Architektura oparta na Supabase umożliwiająca łatwą skalowalność
   - Separacja logiki frontendowej i backendowej
   - Wykorzystanie Edge Functions dla operacji serwerowych

## Schemat bazy danych

Główne tabele w bazie danych PostgreSQL:

- **user_profiles** - profile użytkowników zawierające dane osobowe, adresowe oraz rolę w systemie
- **products** - produkty w sklepie z opisem, ceną, statusem aktywności oraz powiązaniem z kategorią
- **product_images** - zdjęcia produktów w trzech wersjach (thumbnail, medium, original) z kolejnością wyświetlania
- **categories** - hierarchiczny system kategorii i podkategorii produktów (relacja parent-child)
- **orders** - zamówienia zawierające dane wysyłkowe, statusy zamówienia i płatności oraz kwoty
- **order_items** - pozycje zamówienia łączące produkty z zamówieniami wraz z ilością i ceną
- **cart_items** - koszyk użytkownika z zapisanymi produktami i ilościami
- **product_reviews** - opinie użytkowników o produktach z oceną gwiazdkową, statusem akceptacji oraz licznikami głosów
- **review_votes** - głosy użytkowników na opinie (helpful/not_helpful)
- **product_questions** - pytania użytkowników dotyczące produktów
- **product_question_answers** - odpowiedzi moderatorów na pytania użytkowników
- **product_reports** - zgłoszenia produktów do moderacji ze statusem rozpatrzenia
- **report_messages** - wiadomości w dyskusji między użytkownikiem a moderatorem w ramach zgłoszenia
- **themes** - motywy kolorystyczne definiowane przez administratora (3 kolory podstawowe)
- **user_preferences** - preferencje użytkowników (wybrany motyw kolorystyczny)
- **slider_templates** - szablony sliderów dla wyróżnionych produktów z możliwością aktywacji
- **slider_template_products** - powiązanie produktów z szablonami sliderów wraz z kolejnością wyświetlania
- **notifications** - powiadomienia w aplikacji dla użytkowników i moderatorów
- **email_notifications** - historia wysłanych powiadomień email

## Instrukcja uruchomienia

### Wymagania wstępne

- Node.js (wersja 18 lub nowsza)
- npm lub yarn
- Konto Supabase
- Konto Resend (do wysyłki emaili)
- Konto Stripe (do płatności)

### Konfiguracja projektu

1. Sklonuj repozytorium:
   ```bash
   git clone https://github.com/przecinek6/Sklep_PAI.git
   cd Sklep_PAI
   ```

2. Zainstaluj zależności:
   ```bash
   npm install
   ```

3. Utwórz plik `.env` w głównym katalogu projektu i dodaj następujące zmienne środowiskowe:
   ```env
   VITE_SUPABASE_URL=twoj_supabase_url
   VITE_SUPABASE_ANON_KEY=twoj_supabase_anon_key
   VITE_STRIPE_PUBLIC_KEY=twoj_stripe_public_key
   ```

4. Skonfiguruj bazę danych Supabase:
   - Utwórz nowy projekt w Supabase
   - Wykonaj skrypty SQL z katalogu `database/public/` w kolejności
   - Włącz autentykację OAuth dla Google i GitHub w ustawieniach Supabase

5. Skonfiguruj Supabase Edge Functions:
   - Zainstaluj Supabase CLI
   - Wdróż funkcję `process-email` z katalogu `supabase/functions/`
   - Dodaj zmienne środowiskowe w ustawieniach Edge Functions (klucz API Resend)

6. Uruchom aplikację w trybie deweloperskim:
   ```bash
   npm run dev
   ```

7. Aplikacja będzie dostępna pod adresem `http://localhost:port`

### Build produkcyjny

```bash
npm run build
```

Zbudowane pliki znajdą się w katalogu `dist/`.

### Dodatkowe komendy

- `npm run lint` - sprawdzenie błędów ESLint
- `npm run preview` - podgląd buildu produkcyjnego lokalnie