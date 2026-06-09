// NOTA: Este archivo es ignorado cuando se usa Turbopack (Next.js 16 default).
// Tailwind CSS v4 funciona nativamente con Turbopack vía @import "tailwindcss" en globals.css
// Este config solo aplica si se usa webpack explícitamente.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
