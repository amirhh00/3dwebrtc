<script lang="ts">
  import { playerInfo, gameState, availableRooms, micState } from '$lib/store/game.svelte';
  import { fade } from 'svelte/transition';
  import { cn } from '$lib/utils';
  import { Button } from '$lib/components/ui/button';
  import { browser } from '$app/environment';
  import { gameConnection as conn } from '$lib/connections/Game.connection';
  import type { UserDetails } from '$lib/@types/user.type';
  import { MicIcon, MicOff } from 'lucide-svelte';

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
      case 'm':
        $micState = !$micState;
        conn.handleMicToggle($micState);
        break;
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
    if (!!playerInfo.playerName || !!playerInfo.playerColor) {
      userDetails = {
        name: playerInfo.playerName,
        color: playerInfo.playerColor
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
    const playerColor = formData.get('playerColor') as string;
    playerInfo.playerName = uname;
    playerInfo.playerColor = playerColor;
    conn.changeUserDetails(uname, playerColor, gameState.userId);
  }
  // $effect(() => {
  //   $inspect(gameState);
  // });
</script>

<svelte:window on:keydown={onKeyDown} />

<div class="absolute left-2 top-2 z-50">
  {#if gameState?.room?.roomId && gameState.room?.players}
    <!-- show current users in the room on top left of the screen -->
    <p class="ml-px text-xs opacity-50">Lobby</p>
    <ul class="list-none pl-0">
      {#each gameState.room.players as user, i}
        {@const shortenedUserName = !!user.name ? user.name.charAt(0) : i}
        <li
          title={user.name?.toString()}
          class="relative mt-2 flex h-8 w-8 items-center justify-center rounded-full bg-background p-1 text-sm uppercase opacity-50"
        >
          {shortenedUserName}
          {#if user.mic}
            <MicIcon class="absolute -bottom-1 right-0 h-3 w-3" />
          {:else}
            <MicOff class="absolute -bottom-1 right-0 h-3 w-3" />
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

{#if isMainMenuOpen}
  <div
    transition:fade={{ delay: 100, duration: 300 }}
    class={cn(
      'absolute left-0 top-0 z-10 flex h-full w-full items-center justify-center bg-background',
      isFirstRender ? 'opacity-100' : 'opacity-80'
    )}
  >
    <div class="prose text-center dark:prose-invert">
      <h2>{currentMainMenuScreen}</h2>
      <ul class="list-none pl-0 transition duration-500 hover:[&>li]:underline">
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
          <p class="-mt-4 mb-0 text-center text-xs opacity-60">
            {gameState.userId ? 'userId: ' + gameState.userId : ''}
            <br />
            {gameState?.room?.roomId ? 'roomId: ' + gameState.room.roomId : 'no room id found'}
          </p>
          <div class="">
            <label class="mb-3 flex w-full cursor-pointer items-center justify-between">
              Enable microphone
              <input
                checked={$micState}
                onchange={(e) => {
                  // playerInfo.mic = e.currentTarget.checked;
                  const mic = e.currentTarget.checked;
                  $micState = mic;
                  conn.handleMicToggle(mic);
                  // if (!conn.webrtc) {
                  //   WebRTCConnection.handleMicToggle(e.currentTarget.checked, gameState.userId);
                  // }
                }}
                name="mic"
                class="float-end"
                type="checkbox"
              />
            </label>
          </div>
          <form
            onsubmit={handleSettingChange}
            class="prose flex w-full flex-col gap-4 text-left dark:prose-invert"
          >
            <div class="">
              <label class="flex w-full items-center justify-between">
                Player name:
                <input
                  class="float-end ml-4 p-1 text-current"
                  placeholder="Your name"
                  name="username"
                  value={playerInfo.playerName}
                />
              </label>
            </div>
            <div class="">
              <label class="flex w-full items-center justify-between">
                Player color:
                <input
                  value={playerInfo.playerColor}
                  name="playerColor"
                  class="float-end cursor-pointer"
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
