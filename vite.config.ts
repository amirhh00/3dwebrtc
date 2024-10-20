import { sveltekit } from '@sveltejs/kit/vite';
import mkcert from 'vite-plugin-mkcert';
import { defineConfig } from 'vite';

export default defineConfig((cfg) => {
  if (cfg.mode === 'development') {
    return {
      server: { proxy: {} },
      plugins: [sveltekit(), mkcert()]
    };
  }
  return {
    plugins: [sveltekit()]
  };
});
