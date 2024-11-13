<script lang="ts">
  import { gameSettings, gameState, availableRooms } from '$lib/store/game.svelte';
  import { fade } from 'svelte/transition';
  import { cn } from '$lib/utils';
  import { Button } from '$lib/components/ui/button';
  import { browser } from '$app/environment';
  import { gameConnection as conn } from '$lib/connections/Game.connection';
  import type { UserDetails } from '$lib/@types/user.type';

  // svelte-ignore non_reactive_update
  let isFirstRender = true;

  const MainMenuScreens = ['Main Menu', 'Host Game', 'Join Game', 'Settings'] as const;
  let currentMainMenuScreen = $state<(typeof MainMenuScreens)[number]>('Main Menu');
  let isMainMenuOpen = $derived.by(() => {
    if (!gameState.isPaused && isFirstRender) {
      isFirstRender = false;
    }
    return gameState.isPaused;
  });

  function onKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      case 'Escape':
        if (!isFirstRender) {
          currentMainMenuScreen = 'Main Menu';
          gameState.isPaused = !gameState.isPaused;
        }
        break;
      default:
        break;
    }
  }

  async function handleHostGame() {
    currentMainMenuScreen = 'Host Game';
    gameState.isRoomConnecting = true;
    let userDetails: UserDetails | undefined = undefined;
    if (!!gameSettings.playerName || !!gameSettings.playerColor) {
      userDetails = {
        name: gameSettings.playerName,
        color: gameSettings.playerColor
      };
    }
    await conn.createRoom();
  }

  function seekRooms() {
    currentMainMenuScreen = 'Join Game';
    conn.seekRooms();
  }

  function joinRoom(roomId: string) {
    gameState.isRoomConnecting = true;

    conn.joinRoom(roomId);
  }

  async function handleSettingChange(e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const uname = formData.get('username') as string;
    const mic = formData.get('mic') === 'on';
    const muted = formData.get('muted') === 'on';
    const playerColor = formData.get('playerColor') as string;
    gameSettings.mic = mic;
    gameSettings.mute = muted;
    gameSettings.playerName = uname;
    gameSettings.playerColor = playerColor;
    conn.changeUserDetails(uname, playerColor, gameState.userId);
  }
</script>

<svelte:window on:keydown={onKeyDown} />

<div class="absolute top-2 left-2 z-50">
  {#if gameState?.room?.roomId && gameState.room?.players}
    <!-- show current users in the room on top left of the screen -->
    <p class="text-xs opacity-50 ml-px">Lobby</p>
    <ul class="list-none pl-0">
      {#each gameState.room.players as user, i}
        {@const uname = !!user.name ? user.name.charAt(0) : i}
        <li
          title={uname?.toString()}
          class="text-sm uppercase w-8 h-8 bg-background rounded-full opacity-50 flex items-center justify-center p-1 mt-2"
        >
          {uname}
        </li>
      {/each}
    </ul>
  {/if}
</div>

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
      <ul class="list-none pl-0 hover:[&>li]:underline transition duration-500">
        <!-- Main Menu Screen -->
        {#if currentMainMenuScreen === 'Main Menu'}
          <li>
            <button onclick={handleHostGame}> Host a new game </button>
          </li>
          <li>
            <button onclick={seekRooms}> Join a game </button>
          </li>
          <li>
            <button onclick={() => (currentMainMenuScreen = 'Settings')}> Settings </button>
          </li>
          <!-- Host Game Screen -->
        {:else if currentMainMenuScreen === 'Host Game'}
          {#if gameState.isRoomConnecting}
            <li>Connecting...</li>
          {:else}
            <div></div>
          {/if}
          <!-- Join Game Screen -->
        {:else if currentMainMenuScreen === 'Join Game'}
          {#if gameState.isRoomConnecting}
            <li>Connecting...</li>
          {:else}
            {#each availableRooms.rooms as room}
              <li>
                <button onclick={() => joinRoom(room.roomId)}>
                  {`${room.roomName}'s room` || room.roomId}
                </button>
                <span class="ml-4">{room.playersCount}</span>
              </li>
            {/each}
            <li>
              <button onclick={() => (currentMainMenuScreen = 'Main Menu')}> Back </button>
            </li>
          {/if}
          <!-- Settings Screen -->
        {:else if currentMainMenuScreen === 'Settings' && browser}
          <p class="text-center text-xs opacity-60 mb-0 -mt-4">
            {gameState.userId ? 'userId: ' + gameState.userId : ''}
            <br />
            {gameState?.room?.roomId ? 'roomId: ' + gameState.room.roomId : 'no room id found'}
          </p>
          <form
            onsubmit={handleSettingChange}
            class="flex flex-col w-full text-left gap-4 prose dark:prose-invert"
          >
            <div class="">
              <label class="flex w-full justify-between items-center">
                Enable microphone
                <input checked={gameSettings.mic} name="mic" class="float-end" type="checkbox" />
              </label>
            </div>
            <div class="">
              <label class="flex w-full justify-between items-center">
                Mute Sound
                <input checked={gameSettings.mute} name="muted" class="float-end" type="checkbox" />
              </label>
            </div>
            <div class="">
              <label class="flex w-full justify-between items-center">
                Player name:
                <input
                  class="float-end ml-4 p-1 text-current"
                  placeholder="Your name"
                  name="username"
                  value={gameSettings.playerName}
                />
              </label>
            </div>
            <div class="">
              <label class="flex w-full justify-between items-center">
                Player color:
                <input
                  value={gameSettings.playerColor}
                  name="playerColor"
                  class="float-end"
                  type="color"
                />
              </label>
            </div>
            <Button class="w-full" type="submit">Save</Button>
          </form>
          <li>
            <button onclick={() => (currentMainMenuScreen = 'Main Menu')}> Back </button>
          </li>
        {/if}
      </ul>
    </div>
  </div>
{/if}
