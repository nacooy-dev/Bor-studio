/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Apple Design System Colors
        primary: {
          blue: '#007AFF',
          indigo: '#5856D6',
          purple: '#AF52DE',
          teal: '#5AC8FA',
          cyan: '#55BEF0',
          mint: '#00C7BE',
        },
        neutral: {
          white: '#FFFFFF',
          gray: {
            100: '#F2F2F7',
            200: '#E5E5EA',
            300: '#D1D1D6',
            400: '#C7C7CC',
            500: '#AEAEB2',
            600: '#8E8E93',
            700: '#636366',
            800: '#48484A',
            900: '#3A3A3C',
          },
          black: '#000000',
        },
        semantic: {
          success: '#34C759',
          warning: '#FF9500',
          error: '#FF3B30',
          info: '#007AFF',
        },
        // Glass morphism backgrounds
        glass: {
          light: 'rgba(255, 255, 255, 0.8)',
          dark: 'rgba(0, 0, 0, 0.8)',
          blur: 'rgba(255, 255, 255, 0.1)',
        }
      },
      fontFamily: {
        system: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', 'sans-serif'],
        mono: ['"SF Mono"', 'Monaco', '"Cascadia Code"', 'monospace'],
      },
      fontSize: {
        'xs': '12px',
        'sm': '14px',
        'base': '16px',
        'lg': '18px',
        'xl': '20px',
        '2xl': '24px',
        '3xl': '30px',
        '4xl': '36px',
      },
      borderRadius: {
        'sm': '6px',
        'md': '12px',
        'lg': '16px',
        'xl': '20px',
        '2xl': '24px',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      backdropBlur: {
        'xs': '2px',
        'sm': '4px',
        'md': '12px',
        'lg': '16px',
        'xl': '24px',
        '2xl': '40px',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
}