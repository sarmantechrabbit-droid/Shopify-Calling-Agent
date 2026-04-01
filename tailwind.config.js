/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Light theme base colors
        light: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        },
        // Premium dark palette
        dark: {
          950: '#0A0A0B',
          900: '#111113',
          800: '#18181B',
          700: '#27272A',
          600: '#3F3F46',
          500: '#52525B',
          400: '#71717A',
          300: '#A1A1AA',
          200: '#D4D4D8',
          100: '#E4E4E7',
        },
        // Accent colors
        accent: {
          cyan: '#22D3EE',
          emerald: '#34D399',
          amber: '#FBBF24',
          rose: '#FB7185',
          violet: '#A78BFA',
          blue: '#60A5FA',
          indigo: '#6366F1',
        },
        // Status colors
        status: {
          success: '#10B981',
          warning: '#F59E0B',
          error: '#EF4444',
          info: '#3B82F6',
        },
        // Gradient colors
        gradient: {
          primary: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
          accent: 'linear-gradient(135deg, #22D3EE 0%, #3B82F6 100%)',
          success: 'linear-gradient(135deg, #34D399 0%, #10B981 100%)',
          dark: 'linear-gradient(180deg, #111113 0%, #0A0A0B 100%)',
          light: 'linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'premium': '0 4px 24px -4px rgba(0, 0, 0, 0.12), 0 12px 40px -8px rgba(0, 0, 0, 0.08)',
        'premium-sm': '0 2px 8px -2px rgba(0, 0, 0, 0.08), 0 4px 12px -4px rgba(0, 0, 0, 0.04)',
        'premium-light': '0 4px 24px -4px rgba(0, 0, 0, 0.06), 0 12px 40px -8px rgba(0, 0, 0, 0.04)',
        'glow-cyan': '0 0 20px rgba(34, 211, 238, 0.3)',
        'glow-emerald': '0 0 20px rgba(52, 211, 153, 0.3)',
        'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
      },
      backdropBlur: {
        'glass': '12px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'wave': 'wave 1.5s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'counter': 'counter 2s ease-out forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        wave: {
          '0%, 100%': { transform: 'scaleY(0.5)', opacity: '0.5' },
          '50%': { transform: 'scaleY(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        counter: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      borderRadius: {
        'premium': '16px',
        'premium-sm': '12px',
        'premium-xs': '8px',
      },
    },
  },
  plugins: [],
}
