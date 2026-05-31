<script lang="ts">
  import { playerInfo, gameState } from '$lib/store/game.svelte';

  // This will be updated by the Gun component when needed
  let {
    ammo = $bindable(30),
    maxAmmo = 30,
    isReloading = $bindable(false),
    reloadProgress = $bindable(0)
  } = $props();
</script>

<!-- HUD: Health and Ammo counter -->
<div class="fixed bottom-8 right-8 text-white font-bold pointer-events-none z-10">
  <!-- Health Counter -->
  <div class="text-2xl mb-2 {playerInfo.health > 50 ? 'text-green-400' : playerInfo.health > 25 ? 'text-yellow-400' : 'text-red-500'}">
    HP: {playerInfo.health}
  </div>

  <!-- Ammo Counter -->
  <div class="text-3xl mb-2">
    {ammo} / {maxAmmo}
  </div>
  
  <!-- Ammo Bar -->
  <div class="w-32 h-6 bg-gray-800 border-2 border-gray-400 rounded overflow-hidden">
    <div 
      class="h-full {ammo > 10 ? 'bg-green-500' : ammo > 5 ? 'bg-yellow-500' : 'bg-red-500'} transition-all"
      style="width: {(ammo / maxAmmo) * 100}%"
    ></div>
  </div>

  <!-- Reload Progress -->
  {#if isReloading}
    <div class="mt-3 text-sm">
      <div class="mb-1">RELOADING...</div>
      <div class="w-32 h-4 bg-gray-800 border-2 border-yellow-400 rounded overflow-hidden">
        <div 
          class="h-full bg-yellow-400 transition-all"
          style="width: {reloadProgress}%"
        ></div>
      </div>
    </div>
  {:else if ammo === 0}
    <div class="mt-3 text-sm text-red-500 animate-pulse">
      Press R to Reload
    </div>
  {/if}
</div>

<!-- Crosshair -->
<div class="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50">
  <svg width="40" height="40" viewBox="0 0 40 40" class="text-red-500">
    <!-- Outer circle -->
    <circle cx="20" cy="20" r="15" fill="none" stroke="currentColor" stroke-width="1" />
    <!-- Center dot -->
    <circle cx="20" cy="20" r="2" fill="currentColor" />
    <!-- Horizontal line -->
    <line x1="5" y1="20" x2="10" y2="20" stroke="currentColor" stroke-width="1" />
    <line x1="30" y1="20" x2="35" y2="20" stroke="currentColor" stroke-width="1" />
    <!-- Vertical line -->
    <line x1="20" y1="5" x2="20" y2="10" stroke="currentColor" stroke-width="1" />
    <line x1="20" y1="30" x2="20" y2="35" stroke="currentColor" stroke-width="1" />
  </svg>
</div>
