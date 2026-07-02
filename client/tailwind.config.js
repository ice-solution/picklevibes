/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: 'var(--color-primary-50, #fdf2f8)',
          100: 'var(--color-primary-100, #fce7f3)',
          200: 'var(--color-primary-200, #fbcfe8)',
          300: 'var(--color-primary-300, #f9a8d4)',
          400: 'var(--color-primary-400, #f472b6)',
          500: 'var(--color-primary-500, #ec4899)',
          600: 'var(--color-primary-600, #db2777)',
          700: 'var(--color-primary-700, #be185d)',
          800: 'var(--color-primary-800, #9d174d)',
          900: 'var(--color-primary-900, #831843)',
        },
        secondary: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6', // 青綠色 (來自 logo)
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        accent: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b', // 黃色/橙色 (來自 logo 球的顏色)
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        pickcourt: {
          navy: '#0f1f3d',
          'navy-light': '#1a2f52',
          'navy-dark': '#0a1528',
          gold: '#c9a227',
          'gold-light': '#e4c04d',
          'gold-dark': '#9a7b1a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'bounce-slow': 'bounce 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}
