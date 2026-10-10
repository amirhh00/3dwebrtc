<script lang="ts">
  import { playerInfo, gameState, availableRooms, micState } from '$lib/store/game.svelte';
  import { fade } from 'svelte/transition';
  import { gameConnection as conn } from '$lib/connections/Game.connection';
  import { Loader2, Plus, LogIn, Settings as SettingsIcon, Play, LogOut, RefreshCw, Copy, Check, X } from 'lucide-svelte';
  import { toast } from 'svelte-sonner';

  let currentTab = $state<'menu' | 'join' | 'profile' | 'controls'>('menu');
  let manualRoomId = $state('');
  let isLoadingRooms = $state(false);
  let isHosting = $state(false);
  let isCopied = $state(false);

  function closeModal() {
    gameState.isPaused = false;
  }

  function resumeGame() {
    closeModal();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      gameState.isPaused = !gameState.isPaused;
      if (gameState.isPaused) {
        currentTab = 'menu';
      }
    }
  }

  async function handleHostGame() {
    isHosting = true;
    gameState.isRoomConnecting = true;
    try {
      await conn.createRoom();
      toast.success('Room hosted successfully via WebRTC!');
      closeModal();
    } catch (err) {
      console.error(err);
      toast.error('Failed to host room. Ensure backend is running.');
    } finally {
      isHosting = false;
      gameState.isRoomConnecting = false;
    }
  }

  async function openJoinTab() {
    currentTab = 'join';
    await fetchRooms();
  }

  async function fetchRooms() {
    isLoadingRooms = true;
    try {
      await conn.seekRooms();
    } catch {
      toast.error('Could not fetch room list');
    } finally {
      isLoadingRooms = false;
    }
  }

  async function joinRoom(roomId: string) {
    if (!roomId) return;
    gameState.isRoomConnecting = true;
    try {
      await conn.joinRoom(roomId);
      toast.success('Joining room...');
      closeModal();
    } catch (err) {
      console.error(err);
      toast.error('Failed to join room');
    } finally {
      gameState.isRoomConnecting = false;
    }
  }

  async function saveProfile(e: Event) {
    e.preventDefault();
    try {
      await conn.changeUserDetails(playerInfo.playerName, playerInfo.playerColor, gameState.userId);
      toast.success('Profile updated!');
    } catch {
      toast.error('Failed to save profile');
    }
  }

  async function copyCurrentRoomId() {
    if (!gameState.room.roomId) return;
    try {
      await navigator.clipboard.writeText(gameState.room.roomId);
      isCopied = true;
      toast.success('Room Code copied!');
      setTimeout(() => (isCopied = false), 2000);
    } catch {}
  }
</script>

<svelte:window onkeydown={onKeyDown} />

{#if gameState.isPaused}
  <!-- Backdrop: clicking outside the modal box dismisses it -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    transition:fade={{ duration: 150 }}
    class="fixed inset-0 z-[1000] pointer-events-auto flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-4 select-none overflow-y-auto overflow-x-hidden"
    onclick={(e) => {
      if (e.target === e.currentTarget) {
        closeModal();
      }
    }}
    role="dialog"
    aria-modal="true"
    aria-label="Game Menu"
    tabindex="-1"
  >
    <!-- Modal Card -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="relative z-[1001] pointer-events-auto w-full max-w-md max-h-[calc(100dvh-2rem)] flex flex-col rounded-3xl border border-slate-700/60 bg-slate-900/95 p-4 sm:p-6 shadow-2xl text-white overflow-hidden min-w-0"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Modal Header -->
      <div class="mb-4 sm:mb-5 flex items-center justify-between gap-2 border-b border-slate-800 pb-3 sm:pb-4 shrink-0 min-w-0">
        <div class="min-w-0 flex-1">
          <h2 class="text-lg sm:text-xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-sky-300 truncate">
            3D WEBRTC MULTIPLAYER
          </h2>
          <p class="text-[11px] sm:text-xs text-slate-400 truncate">P2P Real-Time 3D Playground</p>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          {#if gameState.room.roomId}
            <div class="hidden xs:flex items-center gap-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 px-2.5 py-1 text-xs font-semibold text-emerald-400">
              <span class="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Online</span>
            </div>
          {/if}

          <!-- Close ("X") button: prominent and always accessible -->
          <button
            onclick={closeModal}
            class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-700/80 bg-slate-800 text-slate-300 hover:border-cyan-500/60 hover:bg-slate-700 hover:text-white transition-all shadow-md active:scale-95"
            title="Close menu [ESC]"
            aria-label="Close menu"
          >
            <X class="h-4 w-4" />
          </button>
        </div>
      </div>

      <!-- Scrollable content area -->
      <div class="overflow-y-auto overflow-x-hidden min-w-0 flex-1 pr-0.5 space-y-3">
        <!-- Main Tabs Content -->
        {#if currentTab === 'menu'}
          <div class="flex flex-col gap-3 min-w-0">
            <!-- Resume Button -->
            <button
              onclick={resumeGame}
              class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3.5 text-sm font-black tracking-wide text-white shadow-lg shadow-cyan-500/25 transition-all hover:scale-[1.02] hover:brightness-110 active:scale-[0.98]"
            >
              <Play class="h-4 w-4 fill-white shrink-0" />
              <span>RESUME PLAYING</span>
            </button>

            <!-- Currently In Room Info -->
            {#if gameState.room.roomId}
              <div class="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-3 sm:p-4 min-w-0">
                <div class="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>Current Room Code</span>
                  <span class="text-emerald-400 font-semibold">{conn.isHost ? 'Host' : 'Guest'}</span>
                </div>
                <div class="flex items-center justify-between gap-2 font-mono text-xs sm:text-sm text-cyan-300 font-bold bg-slate-900 px-3 py-2 rounded-xl border border-slate-700 min-w-0">
                  <span class="truncate min-w-0 flex-1">{gameState.room.roomId}</span>
                  <button onclick={copyCurrentRoomId} title="Copy Room ID" class="cursor-pointer text-slate-400 hover:text-white shrink-0">
                    {#if isCopied}
                      <Check class="h-4 w-4 text-emerald-400" />
                    {:else}
                      <Copy class="h-4 w-4" />
                    {/if}
                  </button>
                </div>
                <button
                  onclick={() => conn.leaveRoom()}
                  class="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-rose-500/40 bg-rose-950/30 py-2 text-xs font-bold text-rose-300 hover:bg-rose-900/40 transition-colors"
                >
                  <LogOut class="h-3.5 w-3.5 shrink-0" />
                  <span>Leave Room</span>
                </button>
              </div>
            {:else}
              <!-- Host Game Button -->
              <button
                onclick={handleHostGame}
                disabled={isHosting}
                class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/80 px-5 py-3 text-sm font-bold text-slate-200 transition-all hover:bg-slate-700/80 hover:text-white active:scale-[0.98]"
              >
                {#if isHosting}
                  <Loader2 class="h-4 w-4 animate-spin text-cyan-400 shrink-0" />
                  <span>Creating Room...</span>
                {:else}
                  <Plus class="h-4 w-4 text-cyan-400 shrink-0" />
                  <span>Host a New Game</span>
                {/if}
              </button>

              <!-- Join Game Button -->
              <button
                onclick={openJoinTab}
                class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/80 px-5 py-3 text-sm font-bold text-slate-200 transition-all hover:bg-slate-700/80 hover:text-white active:scale-[0.98]"
              >
                <LogIn class="h-4 w-4 text-sky-400 shrink-0" />
                <span>Join an Existing Game</span>
              </button>
            {/if}

            <!-- Secondary options -->
            <div class="grid grid-cols-2 gap-2 mt-1">
              <button
                onclick={() => (currentTab = 'profile')}
                class="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-800/40 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <SettingsIcon class="h-3.5 w-3.5 shrink-0" />
                <span>My Avatar</span>
              </button>
              <button
                onclick={() => (currentTab = 'controls')}
                class="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-800/40 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <span>Controls Guide</span>
              </button>
            </div>
          </div>

        <!-- Join Game Tab -->
        {:else if currentTab === 'join'}
          <div class="flex flex-col gap-3 min-w-0">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-bold text-slate-200">Available Rooms</h3>
              <button onclick={fetchRooms} title="Refresh" class="cursor-pointer text-slate-400 hover:text-cyan-400 p-1">
                <RefreshCw class="h-4 w-4 {isLoadingRooms ? 'animate-spin' : ''}" />
              </button>
            </div>

            <!-- Active Rooms List -->
            <div class="max-h-48 overflow-y-auto flex flex-col gap-2 rounded-xl bg-slate-950/60 p-2 border border-slate-800 min-w-0">
              {#if isLoadingRooms}
                <div class="flex flex-col items-center justify-center py-6 text-xs text-slate-400">
                  <Loader2 class="h-5 w-5 animate-spin text-cyan-400 mb-2" />
                  <span>Searching for active rooms...</span>
                </div>
              {:else if availableRooms.rooms.length === 0}
                <div class="py-6 text-center text-xs text-slate-400">
                  No active rooms found on the server.
                  <div class="mt-1 text-slate-500">Host one or enter a room code below!</div>
                </div>
              {:else}
                {#each availableRooms.rooms as room (room.roomId)}
                  <div class="flex items-center justify-between rounded-xl bg-slate-900 p-2.5 border border-slate-800 gap-2 min-w-0">
                    <div class="truncate min-w-0 flex-1">
                      <div class="text-xs font-bold text-slate-200 truncate">{room.roomName || 'WebRTC Room'}</div>
                      <div class="font-mono text-[10px] text-slate-400 truncate">{room.roomId}</div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <span class="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-slate-300">
                        👥 {room.playersCount}
                      </span>
                      <button
                        onclick={() => joinRoom(room.roomId)}
                        class="cursor-pointer rounded-lg bg-cyan-600 px-3 py-1 text-xs font-bold text-white hover:bg-cyan-500 transition-colors"
                      >
                        Join
                      </button>
                    </div>
                  </div>
                {/each}
              {/if}
            </div>

            <!-- Direct Code Input -->
            <div class="border-t border-slate-800 pt-3 min-w-0">
              <label for="manual-room-input" class="block text-xs font-medium text-slate-400 mb-1.5">Or enter Room Code directly:</label>
              <div class="flex gap-2 min-w-0">
                <input
                  id="manual-room-input"
                  bind:value={manualRoomId}
                  placeholder="Paste room ID..."
                  class="flex-1 min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
                <button
                  onclick={() => joinRoom(manualRoomId.trim())}
                  disabled={!manualRoomId.trim()}
                  class="shrink-0 cursor-pointer rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-500 disabled:opacity-50 transition-colors"
                >
                  Join
                </button>
              </div>
            </div>

            <div class="flex gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onclick={() => (currentTab = 'menu')}
                class="flex-1 cursor-pointer rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold text-slate-300 hover:text-white transition-colors"
              >
                Back to Menu
              </button>
              <button
                type="button"
                onclick={closeModal}
                class="cursor-pointer rounded-xl border border-slate-700/80 bg-slate-800/80 px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>

        <!-- Profile Tab -->
        {:else if currentTab === 'profile'}
          <form onsubmit={saveProfile} class="flex flex-col gap-4 min-w-0">
            <div class="min-w-0">
              <label for="profile-name-input" class="block text-xs font-medium text-slate-400 mb-1.5">Player Name</label>
              <input
                id="profile-name-input"
                bind:value={playerInfo.playerName}
                placeholder="Your display name"
                class="w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div class="min-w-0">
              <label for="profile-color-input" class="block text-xs font-medium text-slate-400 mb-1.5">Avatar Color</label>
              <div class="flex items-center gap-3 min-w-0">
                <input
                  id="profile-color-input"
                  type="color"
                  bind:value={playerInfo.playerColor}
                  class="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-slate-700 bg-slate-950 p-1"
                />
                <span class="font-mono text-xs text-slate-300 shrink-0">{playerInfo.playerColor}</span>
                <div
                  class="ml-auto h-8 w-8 shrink-0 rounded-full border border-white/20 shadow-md"
                  style:background-color={playerInfo.playerColor}
                ></div>
              </div>
            </div>

            <div class="flex gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onclick={() => (currentTab = 'menu')}
                class="flex-1 cursor-pointer rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold text-slate-300 hover:text-white transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                class="flex-1 cursor-pointer rounded-xl bg-cyan-600 py-2.5 text-xs font-bold text-white hover:bg-cyan-500 transition-colors shadow-lg shadow-cyan-600/30"
              >
                Save Profile
              </button>
              <button
                type="button"
                onclick={closeModal}
                class="cursor-pointer rounded-xl border border-slate-700/80 bg-slate-800/80 px-3.5 py-2.5 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </form>

        <!-- Controls Tab -->
        {:else if currentTab === 'controls'}
          <div class="flex flex-col gap-3 text-xs text-slate-300 min-w-0">
            <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
              <div class="flex justify-between items-center gap-2">
                <span class="font-bold text-white">Movement</span>
                <span class="font-mono bg-slate-800 px-2 py-0.5 rounded text-cyan-300 shrink-0">W, A, S, D</span>
              </div>
              <div class="flex justify-between items-center gap-2">
                <span class="font-bold text-white">Look Around</span>
                <span class="font-mono bg-slate-800 px-2 py-0.5 rounded text-cyan-300 shrink-0">Mouse</span>
              </div>
              <div class="flex justify-between items-center gap-2">
                <span class="font-bold text-white">Jump</span>
                <span class="font-mono bg-slate-800 px-2 py-0.5 rounded text-cyan-300 shrink-0">Spacebar</span>
              </div>
              <div class="flex justify-between items-center gap-2">
                <span class="font-bold text-white">Sprint</span>
                <span class="font-mono bg-slate-800 px-2 py-0.5 rounded text-cyan-300 shrink-0">Shift</span>
              </div>
              <div class="flex justify-between items-center gap-2">
                <span class="font-bold text-white">Text Chat</span>
                <span class="font-mono bg-slate-800 px-2 py-0.5 rounded text-cyan-300 shrink-0">Enter</span>
              </div>
              <div class="flex justify-between items-center gap-2">
                <span class="font-bold text-white">Voice Mic</span>
                <span class="font-mono bg-slate-800 px-2 py-0.5 rounded text-cyan-300 shrink-0">M</span>
              </div>
              <div class="flex justify-between items-center gap-2">
                <span class="font-bold text-white">Pause / Menu</span>
                <span class="font-mono bg-slate-800 px-2 py-0.5 rounded text-cyan-300 shrink-0">ESC</span>
              </div>
              <div class="flex justify-between items-center gap-2 border-t border-slate-800/80 pt-2 text-cyan-400">
                <span class="font-bold">VR Locomotion</span>
                <span class="font-mono bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800 shrink-0">Left Thumbstick</span>
              </div>
            </div>

            <div class="flex gap-2 pt-1 border-t border-slate-800">
              <button
                type="button"
                onclick={() => (currentTab = 'menu')}
                class="flex-1 cursor-pointer rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold text-slate-300 hover:text-white transition-colors"
              >
                Back to Menu
              </button>
              <button
                type="button"
                onclick={closeModal}
                class="cursor-pointer rounded-xl border border-slate-700/80 bg-slate-800/80 px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
