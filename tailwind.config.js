/** @type {import('tailwindcss').Config} */
module.exports = {
  // Lock dark-mode to class-based triggering only.
  // Since no code ever adds class="dark" to <html>, every dark: variant
  // across the entire codebase is permanently inert — OS preference has
  // zero effect. This is the root-level fix for the "text invisible on
  // refresh" bug without requiring per-component patches.
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-poppins)', 'Poppins', 'system-ui', 'sans-serif'],
        poppins: ['var(--font-poppins)', 'Poppins', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 8px 30px rgba(19, 30, 32, 0.06)',
        card: '0 8px 30px rgba(19, 30, 32, 0.06)',
      },
      colors: {
        // Re-skin palette tokens
        'theme-bg': '#F2EFE6',
        'theme-card': '#FFFFFF',
        'theme-primary': '#3468A1',
        mint: '#C9DFDC',
        'theme-mint': '#C9DFDC',
        'theme-heading': '#131E20',
        'theme-muted': '#6E6B64',
        'theme-border': '#E5E2D9',
        'theme-success': '#3B8F68',
        'theme-amber': '#D98E2B',

        // Reference design system tokens
        brand: {
          primary: '#3468A1',
          'primary-from': '#3468A1',
          'primary-to': '#2B5687',
          secondary: '#3B8F68',
          'secondary-from': '#3B8F68',
          'secondary-to': '#C9DFDC',
          accent: '#D98E2B',
          'accent-from': '#D98E2B',
          'accent-to': '#F97316',
          success: '#3B8F68',
          warning: '#D98E2B',
          danger: '#EF4444',
          neutral: '#6E6B64',
          'wash-from': '#F2EFE6',
          'wash-to': '#F2EFE6',
        },

        // IntelliCivic design system palette
        'ic-navy': 'hsl(var(--ic-navy))',
        'ic-blue': 'hsl(var(--ic-blue))',
        'ic-teal': 'hsl(var(--ic-teal))',
        'ic-indigo': 'hsl(var(--ic-indigo))',
        'ic-action': 'hsl(var(--ic-blue))',
        'ic-light': 'hsl(var(--background))',
        
        // Exact brand hex utility shortcuts
        'civic-navy': '#131E20',
        'nav-parent': '#3468A1',
        'nav-hover': '#C9DFDC',
        'civic-blue': '#3468A1',
        'nav-icon': '#6E6B64',
        'nav-muted': '#6E6B64',
        'nav-section': '#6E6B64',
        'nav-secondary': '#C9DFDC',
        'civic-teal': '#3B8F68',
        'ai-indigo': '#3468A1',
        'success-green': '#3B8F68',
        'warning-amber': '#D98E2B',
        'danger-red': '#DC2626',

        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
};
