<script lang="ts">
  import type { Snippet } from 'svelte';
  import OtherPlayer from './OtherPlayer.svelte';
  import type { PlayerModelProps } from '$lib/@types/3D.type';
  import { gameState, userId } from '$lib/store/game';

  type OtherPlayersProps = {
    PlayerModel: Snippet<[PlayerModelProps]>;
  };

  const { PlayerModel }: OtherPlayersProps = $props();
</script>

{#if $gameState?.room?.players && $gameState.room.players.length > 1}
  {#each $gameState.room.players as player}
    {#if player.id !== $userId}
      <OtherPlayer {PlayerModel} playerColor={player.color} playerName={player.name || player.id} />
    {/if}
  {/each}
{/if}
