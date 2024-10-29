<script lang="ts">
  import PlayerModel from './PlayerModel.svelte';

  type OtherPlayersProps = {
    // PlayerModel: Snippet<[PlayerModelProps]>;
    playerColor?: string;
    playerName: string;
    height: number;
    radius: number;
    playerId: string;
  };

  const props: OtherPlayersProps = $props();
</script>

<PlayerModel {...props} />
