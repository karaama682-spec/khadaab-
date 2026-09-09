/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
            },
            boxShadow: {
                'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.08)',
                'glass-lg': '0 16px 48px 0 rgba(0, 0, 0, 0.12)',
                'glow-brand': '0 0 30px -5px rgb(var(--color-brand-500) / 0.35)',
                'glow-accent': '0 0 30px -5px rgb(var(--color-accent-500) / 0.35)',
                'card-subtle': '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
                'card-hover': '0 20px 35px -10px rgb(0 0 0 / 0.08), 0 1px 3px 0 rgb(0 0 0 / 0.02)',
            },
            colors: {
                brand: {
                    DEFAULT: 'rgb(var(--color-brand-600))',
                    50: 'rgb(var(--color-brand-50))',
                    100: 'rgb(var(--color-brand-100))',
                    200: 'rgb(var(--color-brand-200))',
                    300: 'rgb(var(--color-brand-300))',
                    400: 'rgb(var(--color-brand-400))',
                    500: 'rgb(var(--color-brand-500))',
                    600: 'rgb(var(--color-brand-600))',
                    700: 'rgb(var(--color-brand-700))',
                    800: 'rgb(var(--color-brand-800))',
                    900: 'rgb(var(--color-brand-900))',
                    950: 'rgb(var(--color-brand-950))',
                },
                accent: {
                    DEFAULT: 'rgb(var(--color-accent-600))',
                    50: 'rgb(var(--color-accent-50))',
                    100: 'rgb(var(--color-accent-100))',
                    200: 'rgb(var(--color-accent-200))',
                    300: 'rgb(var(--color-accent-300))',
                    400: 'rgb(var(--color-accent-400))',
                    500: 'rgb(var(--color-accent-500))',
                    600: 'rgb(var(--color-accent-600))',
                    700: 'rgb(var(--color-accent-700))',
                    800: 'rgb(var(--color-accent-800))',
                    900: 'rgb(var(--color-accent-900))',
                    950: 'rgb(var(--color-accent-950))',
                }
            }
        },
    },
    plugins: [],
}
