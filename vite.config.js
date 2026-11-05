import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Em desenvolvimento, o Vite (porta 5173) repassa /api para o servidor Node (porta 3000),
// assim o navegador enxerga tudo na mesma origem e o cookie de sessão funciona.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': process.env.API_URL ?? 'http://localhost:3000',
    },
  },
});
