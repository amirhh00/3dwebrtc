<script lang="ts">
  import { gameConnection } from '$lib/connections/Game.connection';
  import { gameState } from '$lib/store/game.svelte';
  import { MessageSquare } from 'lucide-svelte';

  let showChatBox = $state(false);
  let messageText = $state('');
  let inputRef = $state<HTMLInputElement | null>(null);

  function handleKeyDown(e: KeyboardEvent) {
    if (gameState.isPaused) return;

    if (e.key === 'Enter') {
      if (showChatBox) {
        const text = messageText.trim();
        if (text && gameConnection.webrtc) {
          gameConnection.webrtc.sendMessage(text);
        }
        messageText = '';
        showChatBox = false;
        // Re-focus canvas / game after sending
        const canvas = document.querySelector('canvas');
        if (canvas) canvas.focus();
      } else {
        showChatBox = true;
        setTimeout(() => {
          inputRef?.focus();
        }, 10);
      }
    } else if (e.key === 'Escape' && showChatBox) {
      showChatBox = false;
    }
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

{#if showChatBox}
  <div class="fixed bottom-12 left-4 z-[70] w-80 max-w-[90vw] rounded-2xl border border-cyan-500/40 bg-slate-950/90 p-2.5 shadow-2xl backdrop-blur-md">
    <div class="flex items-center gap-2">
      <MessageSquare class="h-4 w-4 text-cyan-400 shrink-0" />
      <input
        bind:this={inputRef}
        bind:value={messageText}
        type="text"
        placeholder="Type message & press Enter..."
        class="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
      />
    </div>
  </div>
{/if}
