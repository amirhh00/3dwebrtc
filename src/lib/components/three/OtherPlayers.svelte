<script lang="ts">
  import { gameState } from '$lib/store/game.svelte';
  import PlayerModel from './PlayerModel.svelte';

  type OtherPlayersProps = {
    // PlayerModel: Snippet<[PlayerModelProps]>;
    height: number;
    radius: number;
  };

  const { height, radius }: OtherPlayersProps = $props();
</script>

{#if gameState?.room?.players && gameState.room.players.length > 1}
  {#each gameState.room.players as player}
    {#if player.id !== gameState.userId}
      <PlayerModel
        playerColor={player.color || '#000'}
        playerName={player.name ?? player.id}
        playerId={player.id}
        {height}
        {radius}
      />
    {/if}
  {/each}
{/if}
