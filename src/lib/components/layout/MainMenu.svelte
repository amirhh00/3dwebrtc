<script lang="ts">
  import { isPaused, gameSettings } from '$lib/store/game';
  import { fade } from 'svelte/transition';
  import { cn } from '$lib/utils';
  import ioClient from 'socket.io-client';
  import { page } from '$app/stores';
  import { Button } from '$lib/components/ui/button';
  import { browser } from '$app/environment';

  let isMainMenuOpen = $state(false);
  let isFirstRender = $state(true);
  let isConnecting = $state(false);
  let userId = $state('');
  let roomId = $state('');
  let rooms = $state<string[]>([]);
  let socket = $state<ReturnType<typeof ioClient> | null>(null);

  const MainMenuScreens = ['Main Menu', 'Host Game', 'Join Game', 'Settings'] as const;
  let currentMainMenuScreen = $state<(typeof MainMenuScreens)[number]>('Main Menu');

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

  async function handleHostGame() {
    return new Promise<void>((resolve, reject) => {
      try {
        currentMainMenuScreen = 'Host Game';
        isConnecting = true;
        socket = ioClient(`https://${$page.url.host}/`);

        socket.on('name', (data) => (userId = data));

        socket.on('message', (data) => {
          console.log(data);
        });

        socket.emit('createRoom');
        socket.on('roomCreated', (data) => {
          console.log(data);
          roomId = data.roomId;
          isConnecting = false;
          isPaused.set(false);
          resolve();
        });
      } catch (error) {
        console.error(error);
        reject();
      }
    });
  }

  async function seekRooms() {
    return new Promise<void>((resolve, reject) => {
      try {
        currentMainMenuScreen = 'Join Game';
        isConnecting = true;
        socket = ioClient(`https://${$page.url.host}/`);

        socket.on('name', (data) => (userId = data));

        socket.on('message', (data) => {
          console.log(data);
        });

        socket.emit('getRooms');
        socket.on('rooms', (data: string[]) => {
          console.log(data);
          rooms = data;
          isConnecting = false;
          resolve();
        });
      } catch (error) {
        console.error(error);
        reject();
      }
    });
  }

  async function joinRoom(roomId: string) {
    return new Promise<void>((resolve, reject) => {
      try {
        isConnecting = true;
        if (!socket) return;
        socket.emit('joinRoom', roomId);
        roomId = roomId;
        socket.on('roomJoined', (data) => {
          console.log(data);
          isConnecting = false;
          isPaused.set(false);
          resolve();
        });
      } catch (error) {
        console.error(error);
        reject();
      }
    });
  }

  async function handleSettingChange(e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const uname = formData.get('username') as string;
    const mic = formData.get('mic') === 'on';
    const muted = formData.get('muted') === 'on';
    const playerColor = formData.get('playerColor') as string;
    gameSettings.update((settings) => {
      settings.playerName = uname;
      settings.mic = mic;
      settings.mute = muted;
      settings.playerColor = playerColor;
      return settings;
    });
  }
</script>

<svelte:window on:keydown={onKeyDown} />

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
        {:else if currentMainMenuScreen === 'Host Game'}
          {#if isConnecting}
            <li>Connecting...</li>
          {:else}
            <div></div>
          {/if}
        {:else if currentMainMenuScreen === 'Join Game'}
          {#if isConnecting}
            <li>Connecting...</li>
          {:else}
            {#each rooms as room}
              <li>
                <button onclick={() => joinRoom(room)}>{room}</button>
              </li>
            {/each}
            <li>
              <button onclick={() => (currentMainMenuScreen = 'Main Menu')}> Back </button>
            </li>
          {/if}
        {:else if currentMainMenuScreen === 'Settings' && browser}
          <form
            onsubmit={handleSettingChange}
            class="flex flex-col w-full text-left gap-4 prose dark:prose-invert"
          >
            <div class="">
              <label class="flex w-full justify-between items-center">
                Enable microphone
                <input checked={$gameSettings.mic} name="mic" class="float-end" type="checkbox" />
              </label>
            </div>
            <div class="">
              <label class="flex w-full justify-between items-center">
                Mute Sound
                <input
                  checked={$gameSettings.mute}
                  name="muted"
                  class="float-end"
                  type="checkbox"
                />
              </label>
            </div>
            <div class="">
              <label class="flex w-full justify-between items-center">
                Player name:
                <input
                  class="float-end ml-4 p-1 text-current"
                  placeholder="Your name"
                  name="username"
                  value={$gameSettings.playerName}
                />
              </label>
            </div>
            <div class="">
              <label class="flex w-full justify-between items-center">
                Player color:
                <input
                  value={$gameSettings.playerColor}
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
