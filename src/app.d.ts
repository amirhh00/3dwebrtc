// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
  namespace App {
    interface Locals {}

    interface Platform {
      env: {
        COUNTER: DurableObjectNamespace;
      };
      context: {
        waitUntil(promise: Promise<any>): void;
      };
      caches: CacheStorage & { default: Cache };
    }

    interface Session {}

    interface Stuff {}
  }
  interface CloudflareWebsocket {
    accept(): unknown;
    addEventListener(
      event: 'close',
      callbackFunction: (code?: number, reason?: string) => unknown
    ): unknown;
    addEventListener(event: 'error', callbackFunction: (e: unknown) => unknown): unknown;
    addEventListener(
      event: 'message',
      callbackFunction: (event: { data: any }) => unknown
    ): unknown;
    addEventListener(event: 'open', callbackFunction: () => unknown): unknown;
    addEventListener(event: string, callbackFunction: (...args: any[]) => unknown): unknown;

    /**
     * @param code https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent
     * @param reason
     */
    close(code?: number, reason?: string): unknown;
    send(message: string | Uint8Array): unknown;
  }

  class WebSocketPair {
    0: CloudflareWebsocket; // Client
    1: CloudflareWebsocket; // Server
  }

  interface ResponseInit {
    webSocket?: CloudflareWebsocket;
  }
}

export {};
