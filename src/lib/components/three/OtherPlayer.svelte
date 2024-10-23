<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { PlayerModelProps } from '$lib/@types/3D.type';

  type OtherPlayersProps = {
    PlayerModel: Snippet<[PlayerModelProps]>;
    playerColor?: string;
    playerName: string;
  };

  const { PlayerModel, playerColor = 'black', playerName }: OtherPlayersProps = $props();
  let position = $state<[number, number, number]>([Math.random() * 10, 3, Math.random() * 5]);
</script>

{@render PlayerModel({ meshProps: { position }, playerColor, playerName })}
