import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig, type PluginOption, type ServerOptions } from 'vite';

export default defineConfig(() => {
  const plugins: PluginOption[] = [tailwindcss(), sveltekit()];
  if (process.env.HTTPS === 'true') {
    plugins.push(basicSsl());
  }

  const server: ServerOptions = {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        ws: true
      }
    }
  };

  return {
    server,
    plugins
  };
});
