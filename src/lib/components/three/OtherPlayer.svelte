<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { PlayerModelProps } from '$lib/@types/3D.type';
  import PlayerModel from './PlayerModel.svelte';

  type OtherPlayersProps = {
    // PlayerModel: Snippet<[PlayerModelProps]>;
    playerColor?: string;
    playerName: string;
    height: number;
    radius: number;
  };

  const props: OtherPlayersProps = $props();
</script>

<PlayerModel {...props} />
