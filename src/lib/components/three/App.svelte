<script lang="ts">
  import { Canvas } from '@threlte/core';
  import { World } from '@threlte/rapier';
  import { XR, VRButton, useXR } from '@threlte/xr';
  import Scene from './Scene.svelte';
  import MainMenu from '$lib/components/layout/MainMenu.svelte';
  import { browser } from '$app/environment';
  import ChatBox from '$lib/components/ChatBox.svelte';
  import GameEventLog from '$lib/components/GameEventLog.svelte';
  import VoiceActivityMonitor from '$lib/components/VoiceActivityMonitor.svelte';
  import { onMount } from 'svelte';
  import { playerInfo, gameState, micState } from '$lib/store/game.svelte';
  import { gameConnection } from '$lib/connections/Game.connection';
  import type { UserServer } from '$lib/@types/user.type';
  import { Users, Wifi, Copy, Check, Mic, MicOff, Menu } from 'lucide-svelte';
  import { toast } from 'svelte-sonner';

  interface AppProps {
    user: UserServer;
  }

  const { user }: AppProps = $props();
  const { isPresenting } = useXR();

  let isPointerLocked = $state(false);
  let isCopied = $state(false);

  const playerCount = $derived(
    gameState.room?.players?.length ? gameState.room.players.length : 1
  );

  onMount(() => {
    if (browser) {
      playerInfo.playerName = user.name || 'Player';
      playerInfo.playerColor = user.color || '#0284c7';
      gameState.userId = user.id;
    }

    const handlePointerLockChange = () => {
      isPointerLocked = document.pointerLockElement !== null;
    };

    document.addEventListener('pointerlockchange', handlePointerLockChange);
    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
    };
  });

  function toggleMic() {
    $micState = !$micState;
    void gameConnection.handleMicToggle($micState);
  }

  async function copyRoomId() {
    if (!gameState.room.roomId) return;
    try {
      await navigator.clipboard.writeText(gameState.room.roomId);
      isCopied = true;
      toast.success('Room Code copied to clipboard!');
      setTimeout(() => (isCopied = false), 2000);
    } catch {
      toast.error('Failed to copy room code');
    }
  }

  function openMenu() {
    gameState.isPaused = true;
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }
</script>

<div class="relative h-full w-full select-none overflow-hidden bg-slate-950 font-sans">
  <VoiceActivityMonitor />

  <!-- TOP HUD: Clean Multiplayer Status & Actions -->
  {#if !$isPresenting}
    <header class="pointer-events-auto absolute top-2 sm:top-3 left-2 sm:left-3 right-2 sm:right-3 z-30 flex items-center justify-between gap-2 max-w-[calc(100vw-1rem)] min-w-0">
      <!-- Left: Status Badge & Room Info -->
      <div class="flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0">
        {#if gameState.room.roomId}
          <!-- In Multiplayer Room -->
          <div class="flex items-center gap-1.5 sm:gap-2 rounded-xl border border-emerald-500/30 bg-slate-900/85 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-md shrink-0">
            <span class="flex h-2 w-2 relative shrink-0">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            <span class="text-emerald-400 font-bold uppercase tracking-wider text-[11px] sm:text-xs">
              {gameConnection.isHost ? 'Host' : 'Guest'}
            </span>
            <span class="text-slate-400 hidden xs:inline">|</span>
            <span class="font-mono text-slate-300 text-[11px] sm:text-xs hidden xs:inline">Room: {gameState.room.roomId.slice(0, 6)}...</span>
            <button
              onclick={copyRoomId}
              title="Copy Room ID"
              class="ml-0.5 cursor-pointer rounded-md bg-slate-800 p-1 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors shrink-0"
            >
              {#if isCopied}
                <Check class="h-3.5 w-3.5 text-emerald-400" />
              {:else}
                <Copy class="h-3.5 w-3.5" />
              {/if}
            </button>
          </div>
        {:else}
          <!-- Solo Sandbox -->
          <div class="flex items-center gap-1.5 sm:gap-2 rounded-xl border border-sky-500/30 bg-slate-900/85 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-md shrink-0">
            <Wifi class="h-3.5 w-3.5 text-sky-400 shrink-0" />
            <span class="text-sky-300 text-[11px] sm:text-xs hidden xs:inline">Solo Sandbox</span>
            <span class="text-sky-300 text-[11px] xs:hidden">Solo</span>
          </div>
        {/if}

        <!-- Online Player Counter -->
        <div class="flex items-center gap-1.5 rounded-xl border border-slate-700/60 bg-slate-900/85 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold text-slate-200 shadow-lg backdrop-blur-md shrink-0">
          <Users class="h-3.5 w-3.5 text-cyan-400 shrink-0" />
          <span>{playerCount}</span>
          <span class="hidden sm:inline">{playerCount === 1 ? 'Player' : 'Players'}</span>
        </div>
      </div>

      <!-- Right: VR Button, Profile, Mic Toggle, Menu Button -->
      <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <!-- Player Color Indicator (hidden on small mobile screens to save space) -->
        <div
          class="hidden md:flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-900/85 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-md shrink-0"
          title="Your Player Tag"
        >
          <span
            class="h-3.5 w-3.5 rounded-full ring-2 ring-white/20 shrink-0"
            style:background-color={playerInfo.playerColor || '#0284c7'}
          ></span>
          <span class="max-w-[90px] sm:max-w-[120px] truncate">{playerInfo.playerName || 'Player'}</span>
        </div>

        <!-- WebXR SteamVR Button -->
        <VRButton
          class="flex cursor-pointer items-center gap-1.5 rounded-xl border border-cyan-500/50 bg-slate-900/90 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-black tracking-wide text-cyan-300 shadow-lg shadow-cyan-500/20 backdrop-blur-md hover:bg-cyan-950/80 hover:text-white transition-all shrink-0"
          styled={false}
          onerror={(err) => {
            console.warn('[WebXR] Failed to start VR session:', err);
            toast.error('VR headset not found or SteamVR not active');
          }}
        />

        <!-- Microphone Toggle Button -->
        <button
          onclick={toggleMic}
          title={$micState ? 'Mute Microphone (M)' : 'Unmute Microphone (M)'}
          class="flex cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-bold transition-all shadow-lg backdrop-blur-md shrink-0 {$micState
            ? 'border-emerald-500/50 bg-emerald-950/80 text-emerald-300 ring-2 ring-emerald-500/30'
            : 'border-slate-700/60 bg-slate-900/85 text-slate-400 hover:text-white'}"
        >
          {#if $micState}
            <Mic class="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span class="hidden sm:inline">Mic On</span>
          {:else}
            <MicOff class="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span class="hidden sm:inline">Muted</span>
          {/if}
        </button>

        <!-- Menu Button -->
        <button
          onclick={openMenu}
          class="flex cursor-pointer items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-slate-900/85 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-bold text-cyan-300 shadow-lg backdrop-blur-md hover:bg-cyan-950/50 hover:text-cyan-200 transition-colors shrink-0"
        >
          <Menu class="h-3.5 w-3.5 shrink-0" />
          <span class="hidden sm:inline">Menu [ESC]</span>
          <span class="sm:hidden">Menu</span>
        </button>
      </div>
    </header>
  {/if}

  <!-- 3D WebGL / WebXR Canvas -->
  <div class="h-full w-full">
    <!-- Click to Focus / Pointer Lock Prompt (Desktop only) -->
    {#if !gameState.isPaused && !isPointerLocked && !$isPresenting}
      <div class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
        <div class="pointer-events-auto cursor-pointer rounded-2xl border border-cyan-500/40 bg-slate-950/85 p-6 text-center text-white shadow-2xl backdrop-blur-md transition-transform hover:scale-105">
          <div class="mb-2 text-3xl">🎮</div>
          <h3 class="mb-1 text-lg font-black text-cyan-400">CLICK ANYWHERE TO MOVE & LOOK</h3>
          <p class="mb-4 text-xs text-slate-300">Your cursor will be locked to look around naturally with your mouse</p>
          <div class="flex flex-wrap items-center justify-center gap-2 text-[11px] font-mono text-slate-300">
            <span class="rounded bg-slate-800 px-2 py-1 border border-slate-700 font-bold text-cyan-300">W A S D</span> Walk
            <span class="rounded bg-slate-800 px-2 py-1 border border-slate-700 font-bold text-cyan-300">SPACE</span> Jump
            <span class="rounded bg-slate-800 px-2 py-1 border border-slate-700 font-bold text-cyan-300">SHIFT</span> Sprint
            <span class="rounded bg-slate-800 px-2 py-1 border border-slate-700 font-bold text-cyan-300">ESC</span> Menu
          </div>
        </div>
      </div>
    {/if}

    <Canvas dpr={1}>
      <XR referenceSpace="local-floor" frameRate={90} foveation={1} />
      <World>
        <Scene />
      </World>
    </Canvas>
  </div>

  <!-- Bottom Controls Quick Bar -->
  {#if !$isPresenting && !gameState.isPaused}
    <footer class="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 z-20 hidden sm:flex items-center gap-3 rounded-full border border-slate-800 bg-slate-950/70 px-4 py-1.5 font-mono text-[11px] text-slate-400 backdrop-blur-sm">
      <span><strong class="text-slate-200">WASD</strong> Move</span>
      <span>•</span>
      <span><strong class="text-slate-200">Space</strong> Jump</span>
      <span>•</span>
      <span><strong class="text-slate-200">Shift</strong> Sprint</span>
      <span>•</span>
      <span><strong class="text-slate-200">Enter</strong> Chat</span>
      <span>•</span>
      <span><strong class="text-slate-200">M</strong> Mic</span>
      <span>•</span>
      <span><strong class="text-slate-200">ESC</strong> Menu</span>
    </footer>
  {/if}

  <GameEventLog />
  <ChatBox />
  <MainMenu />
</div>
