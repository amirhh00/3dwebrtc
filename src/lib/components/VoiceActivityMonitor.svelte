<script lang="ts">
  import { AudioContext } from 'three';
  import { onMount } from 'svelte';
  import {
    computeVoiceSig,
    resyncVoiceMonitorsFromGameState
  } from '$lib/audio/voiceMonitors.svelte';

  function unlockAudio() {
    void AudioContext.getContext().resume();
  }

  onMount(() => {
    let appliedSig = '';
    let cleanup: (() => void) | undefined;
    const tick = () => {
      const next = computeVoiceSig();
      if (next === appliedSig) return;
      appliedSig = next;
      cleanup?.();
      cleanup = resyncVoiceMonitorsFromGameState();
    };
    tick();
    const id = window.setInterval(tick, 400);
    return () => {
      window.clearInterval(id);
      cleanup?.();
      appliedSig = '';
    };
  });
</script>

<svelte:window on:pointerdown={unlockAudio} on:keydown={unlockAudio} />
