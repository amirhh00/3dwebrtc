<script lang="ts">
  import { gameConnection } from '$lib/connections/Game.connection';

  let showChatBox = $state(false);
  let textBoxRef: HTMLInputElement | null = $state(null);
</script>

<svelte:window
  on:keydown={(e) => {
    // if is Enter key, send message and hide chat box
    if (e.key === 'Enter') {
      // send message
      if (showChatBox && textBoxRef && !!textBoxRef.value) {
        gameConnection.webrtc?.sendMessage(textBoxRef.value);
      }
      // hide chat box
      showChatBox = !showChatBox;
    }
  }}
/>

{#if showChatBox}
  <div class="absolute bottom-0 right-0 z-50 rounded-lg bg-white p-2 shadow-lg">
    <!-- svelte-ignore a11y_autofocus -->
    <input autofocus id="chatBox" bind:this={textBoxRef} type="text" class="w-full" />
  </div>
{/if}
