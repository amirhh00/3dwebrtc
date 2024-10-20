<script lang="ts">
  import { isPaused } from '$lib/store/game';
  import { fade } from 'svelte/transition';
  import { cn } from '$lib/utils';

  let isMainMenuOpen = false;
  let isFirstRender = true;
  let isConnecting = false;
  const MainMenuScreens = ['Main Menu', 'Host Game', 'Join Game', 'Settings'] as const;
  let currentMainMenuScreen: (typeof MainMenuScreens)[number] = 'Main Menu';

  isPaused.subscribe((value) => {
    if (value) {
      isMainMenuOpen = true;
    } else {
      isMainMenuOpen = false;
      isFirstRender = false;
    }
  });
  function onKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      case 'Escape':
        if (!isFirstRender) {
          currentMainMenuScreen = 'Main Menu';
          isPaused.update((p) => !p);
        }
        break;
      default:
        break;
    }
  }
  function handleHostGame() {
    currentMainMenuScreen = 'Host Game';
    isConnecting = true;
    setTimeout(() => {
      isConnecting = false;
      isPaused.set(false);
    }, 2000);
  }
</script>

<svelte:window on:keydown|preventDefault={onKeyDown} />

{#if isMainMenuOpen}
  <div
    transition:fade={{ delay: 100, duration: 300 }}
    class={cn(
      'absolute flex justify-center items-center w-full h-full top-0 left-0 bg-background z-10',
      isFirstRender ? 'opacity-100' : 'opacity-80'
    )}
  >
    <div class="prose dark:prose-invert text-center">
      <h2>{currentMainMenuScreen}</h2>
      <ul class="list-none pl-0 hover:[&>*]:underline transition duration-500">
        {#if currentMainMenuScreen === 'Main Menu'}
          <li>
            <button on:click={handleHostGame}> Host a new game </button>
          </li>
          <li>Join a Game</li>
          <li>
            <button on:click={() => (currentMainMenuScreen = 'Settings')}> Settings </button>
          </li>
        {:else if currentMainMenuScreen === 'Host Game'}
          {#if isConnecting}
            <li>Connecting...</li>
          {:else}
            <div></div>
          {/if}
        {:else if currentMainMenuScreen === 'Join Game'}
          <li>Host Game</li>
          <li>Join Game</li>
          <li>Settings</li>
        {:else if currentMainMenuScreen === 'Settings'}
          <li>Host Game</li>
          <li>Join Game</li>
          <li>
            <button on:click={() => (currentMainMenuScreen = 'Main Menu')}> Back </button>
          </li>
        {/if}
      </ul>
    </div>
  </div>
{/if}
