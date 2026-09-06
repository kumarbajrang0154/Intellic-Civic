/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // IntelliCivic design system palette
        'ic-navy': 'hsl(var(--ic-navy))',
        'ic-blue': 'hsl(var(--ic-blue))',
        'ic-teal': 'hsl(var(--ic-teal))',
        'ic-indigo': 'hsl(var(--ic-indigo))',
        'ic-action': 'hsl(var(--ic-blue))',
        'ic-light': 'hsl(var(--background))',
        
        // Exact brand hex utility shortcuts
        'civic-navy': '#0F2747',
        'nav-parent': '#284A70',
        'nav-hover': '#183A5F',
        'civic-blue': '#1769AA',
        'nav-icon': '#7FA9CC',
        'nav-muted': '#A8BDD1',
        'nav-section': '#8FAAC2',
        'nav-secondary': '#C4D3E0',
        'civic-teal': '#0F8B8D',
        'ai-indigo': '#6366F1',
        'success-green': '#16A34A',
        'warning-amber': '#F59E0B',
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
