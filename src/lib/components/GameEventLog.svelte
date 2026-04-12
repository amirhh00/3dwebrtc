<script lang="ts">
  import { gameEventLog } from '$lib/store/gameEventLog.svelte';
</script>

<div
  class="pointer-events-none absolute bottom-4 left-4 z-[60] flex max-h-[min(38vh,16rem)] w-[min(92vw,22rem)] flex-col justify-end gap-0.5 overflow-hidden text-left font-mono text-[11px] leading-snug sm:text-xs"
  aria-live="polite"
  aria-relevant="additions"
>
  <div class="flex flex-col justify-end gap-0.5 overflow-y-auto pr-1 [mask-image:linear-gradient(to_bottom,transparent,black_12%)]">
    {#each gameEventLog.lines as line (line.id)}
      <p class="m-0 break-words text-foreground/90 drop-shadow-sm">
        {#each line.segments as seg}
          {#if seg.playerName}
            <strong class="font-bold" style:color={seg.color}>{seg.text}</strong>
          {:else if seg.color}
            <span style:color={seg.color}>{seg.text}</span>
          {:else}
            <span class="text-foreground/85">{seg.text}</span>
          {/if}
        {/each}
      </p>
    {/each}
  </div>
</div>
