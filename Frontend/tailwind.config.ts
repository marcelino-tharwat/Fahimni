import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        cairo: ['Cairo', 'sans-serif'],
      },

      colors: {
        accent: '#00C9DB',

        // ─── Brand Navy (Hero, Navbar, Footer, Dark Sections) ───
        navy: {
          950: '#08061B',
          900: '#0F0A2B',
          800: '#1A103D',
          700: '#251758',
          600: '#37306B',
          500: '#4A3F8A',
          400: '#6358A8',
          300: '#8B83BF',
          200: '#B8B3D6',
          100: '#E0DEEF',
          50: '#F4F3FB',
        },

        // ─── Cyan Accent (CTAs, Links, Active States, Progress) ───
        cyan: {
          900: '#065A60',
          800: '#0B8A8F',
          700: '#0CA5AB',
          600: '#00B8C4',
          500: '#00C9DB',
          400: '#22D9E8',
          300: '#5CE6F0',
          200: '#99EFF5',
          100: '#CCF7FA',
          50: '#E8FCFD',
        },

        // ─── Purple (Success, Badges, Achievements, Enrolled) ───
        purple: {
          900: '#3B0F8A',
          800: '#4C1D95',
          700: '#5B21B6',
          600: '#6D28D9',
          500: '#7C3AED',
          400: '#8B5CF6',
          300: '#A78BFA',
          200: '#C4B5FD',
          100: '#DDD6FE',
          50: '#F0ECFE',
        },

        // ─── Neutrals (Text, Borders, Backgrounds) ───
        gray: {
          900: '#1F2937',
          800: '#374151',
          700: '#4B5563',
          600: '#6B7280',
          500: '#9CA3AF',
          400: '#D1D5DB',
          300: '#E5E7EB',
          200: '#F3F4F6',
          100: '#F9FAFB',
          50: '#FAFAFA',
        },

        // ─── Semantic Colors ───
        danger: {
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
          50: '#FEF2F2',
        },
        warning: {
          500: '#F59E0B',
          600: '#D97706',
          50: '#FFFBEB',
        },
        success: {
          500: '#10B981',
          600: '#059669',
          50: '#ECFDF5',
        },
        pink: {
          500: '#EC4899',
          50: '#FDF2F8',
        },

        // ─── WhatsApp Green (Brand Color) ───
        whatsapp: {
          DEFAULT: '#25D366',
          hover: '#128C7E',
          active: '#075E54',
          light: 'rgba(37, 211, 102, 0.12)',
        },
      },

      // ─── Border Radius ───
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '20px',
        '2xl': '24px',
        full: '9999px',
        btn: '12px', // buttons
        card: '14px', // cards
        input: '10px', // inputs
        badge: '20px', // pill badges
      },

      // ─── Shadows (from DESIGN.md elevation) ───
      boxShadow: {
        card: '0 2px 12px rgba(0, 0, 0, 0.06)',
        elevated: '0 4px 12px rgba(0, 0, 0, 0.08)',
        modal: '0 8px 24px rgba(0, 0, 0, 0.12)',
        glow: '0 0 20px rgba(0, 201, 219, 0.25)', // cyan glow for hover
      },

      // ─── Spacing ───
      spacing: {
        '18': '4.5rem', // 72px
        '22': '5.5rem', // 88px
      },

      // ─── Typography ───
      fontSize: {
        h1: ['28px', { lineHeight: '1.3', fontWeight: '800' }],
        h2: ['22px', { lineHeight: '1.3', fontWeight: '700' }],
        h3: ['18px', { lineHeight: '1.3', fontWeight: '600' }],
        body: ['14px', { lineHeight: '1.6', fontWeight: '400' }],
        small: ['12px', { lineHeight: '1.5', fontWeight: '500' }],
        caption: ['11px', { lineHeight: '1.4', fontWeight: '400' }],
      },

      // ─── Background Gradients ───
      backgroundImage: {
        'hero-gradient':
          'linear-gradient(135deg, #0F0A2B 0%, #1A103D 40%, #37306B 100%)',
        'cta-gradient': 'linear-gradient(135deg, #1A103D 0%, #37306B 100%)',
        'card-dark': 'linear-gradient(180deg, #1A103D 0%, #251758 100%)',
        'cyan-gradient': 'linear-gradient(135deg, #00C9DB 0%, #0EA5E9 100%)',
        'green-gradient': 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
        'purple-gradient': 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
      },

      // ─── Animations ───
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      animation: {
        float: 'float 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
