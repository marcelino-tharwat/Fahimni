# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Project Structure

This project uses a **feature-based architecture**: each feature is a self-contained module that co-locates its own `pages`, `components`, `hooks`, `api`, `store`, validation, and `types` together, rather than splitting them across global type-based folders. Truly cross-cutting code lives under `shared/`.

```text
src/
├── main.tsx                       # Application entry point — mounts React to the DOM
│
├── app/                           # App bootstrap: routing, providers, and app-level config
│   ├── App.tsx                    # Root application component
│   ├── router.tsx                 # Central route definitions
│   ├── config/                    # App-wide configuration
│   │   └── queryClient.ts         # React Query client setup
│   └── providers/                 # Global context/provider composition
│       └── AppProviders.tsx       # Wraps the app with all required providers
│
├── assets/                        # Static assets (images, icons) imported by the bundler
│   ├── hero.png
│   └── vite.svg
│
├── features/                      # Feature modules (feature-based architecture)
│   ├── admin/                     # Platform admin feature — tenant management
│   │   └── pages/                 # TenantsPage.tsx, TenantDetailsPage.tsx
│   │
│   ├── auth/                      # Authentication feature (login, OTP, reset password)
│   │   ├── api/                   # auth.ts — auth HTTP calls
│   │   ├── components/            # OtpInput, PasswordStrengthBar, Stepper, StepEmailForm,
│   │   │                          #   StepOtpVerify, StepNewPassword
│   │   ├── hooks/                 # useAuth.ts
│   │   ├── lib/                   # token.ts — token storage/helpers
│   │   ├── pages/                 # AuthPage.tsx, ResetPasswordPage.tsx
│   │   ├── store/                 # authSlice.ts — auth Redux slice
│   │   └── schemas.ts             # Zod/validation schemas for auth forms
│   │
│   ├── landing/                   # Public landing feature
│   │   └── pages/                 # LandingPage.tsx, NotFoundPage.tsx
│   │
│   ├── student/                   # Student feature — courses, lessons, quizzes, AI tutor
│   │   ├── api/                   # aiTutor.ts, content.ts, enrollment.ts, payment.ts, quiz.ts
│   │   └── pages/                 # StudentDashboardPage, MyCoursesPage, AllContentPage,
│   │                              #   LessonPage, QuizPage, QuizResultsPage, AiTutorPage,
│   │                              #   PaymentPage, StudentProfilePage
│   │
│   ├── support/                   # Support-staff feature — student lookup, promo codes
│   │   ├── api/                   # support.ts
│   │   ├── mocks/                 # promoCodes.ts — mock data
│   │   └── pages/                 # StudentLookupPage.tsx, PromoCodesPage.tsx
│   │
│   ├── teacher/                   # Teacher feature — content, quizzes, branding, analytics
│   │   ├── api/                   # teacher.ts
│   │   ├── hooks/                 # useTeacherProfile.ts
│   │   ├── pages/                 # TeacherDashboardPage, ContentManagerPage,
│   │   │                          #   AiQuizGeneratorPage, StudentEngagementPage,
│   │   │                          #   TeacherBrandingPage, TeacherSettingsPage
│   │   ├── store/                 # teacherSlice.ts
│   │   ├── types/                 # teacher.ts — teacher domain types
│   │   └── validation.ts          # Teacher form validation
│   │
│   └── tenant/                    # Multi-tenant resolution feature
│       ├── hooks/                 # useTenant.ts
│       ├── lib/                   # resolver.ts — resolves active tenant
│       └── store/                 # tenantSlice.ts
│
├── shared/                        # Cross-cutting code shared across features
│   ├── components/                # Reusable components
│   │   ├── common/                # LanguageSwitcher.tsx
│   │   ├── guards/                # Route guards: AuthGuard, RoleGuard, TenantGuard,
│   │   │                          #   ErrorBoundary
│   │   ├── layout/                # Layout shells: PublicLayout, StudentLayout,
│   │   │                          #   TeacherLayout, AdminLayout, SupportLayout,
│   │   │                          #   Sidebar, Topbar
│   │   └── ui/                    # Design-system primitives: Button, Input, Card, Modal,
│   │                              #   Table, Tabs, Toast, Badge, Avatar, Spinner, Skeleton,
│   │                              #   Progress, StatCard, EmptyState, ConfirmDialog (+ index.ts)
│   ├── hooks/                     # Shared hooks: useDirection.ts, useMediaQuery.ts
│   ├── lib/                       # Shared libraries/utilities
│   │   ├── api/                   # client.ts (HTTP client), errors.ts
│   │   ├── i18n/                  # Internationalization (index.ts setup)
│   │   │   ├── ar/                # Arabic translations: auth, common, landing, student, teacher
│   │   │   └── en/                # English translations: auth, common, landing, student, teacher
│   │   └── utils/                 # cn.ts, formatCurrency.ts, formatDate.ts
│   ├── mocks/                     # Shared mock data: analytics, content, enrollment,
│   │                              #   quizzes, tenant, users
│   ├── store/                     # Redux store setup
│   │   ├── index.ts               # Store configuration
│   │   ├── hooks.ts               # Typed useAppDispatch/useAppSelector
│   │   ├── types.ts               # Store-level types
│   │   └── slices/                # Global slices: uiSlice.ts, toastSlice.ts
│   └── types/                     # Shared domain types: aiTutor, api, content, enrollment,
│                                  #   payment, quiz, tenant, user (+ index.ts)
│
└── styles/                        # Global styles: globals.css, tokens.css (design tokens)
```

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
