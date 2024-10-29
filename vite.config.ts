import { sveltekit } from '@sveltejs/kit/vite';
// import mkcert from 'vite-plugin-mkcert';
import { defineConfig, type PluginOption, type ServerOptions } from 'vite';
import { initializeSocket } from './vite-ws-dev.ts';

export default defineConfig((cfg) => {
  let server: ServerOptions | undefined = undefined;
  const plugins: PluginOption[] = [
    sveltekit(),
    {
      name: 'vite-plugin-mkcert',
      configureServer(server) {
        initializeSocket(server.httpServer);
      }
    }
  ];
  if (cfg.mode === 'development') {
    // plugins.push(mkcert());
    server = {
      // proxy: {}
    };
  }
  return {
    server,
    plugins
  };
});
