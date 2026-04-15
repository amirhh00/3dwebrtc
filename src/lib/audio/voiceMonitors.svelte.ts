// ✅ FIX: Use the native browser AudioContext, NOT Three.js's AudioContext wrapper.
// Three.js's AudioContext.getContext() ties the audio graph to Three's lifecycle and
// can produce a stale/suspended context after a scene reload, breaking voice detection.
import type { UserClient } from '$lib/store/game.svelte';
import { audioUi, gameState } from '$lib/store/game.svelte';

/** True while RMS voice energy is above threshold (Discord-style indicator). */
export const voiceActivity = $state({
  speaking: {} as Record<string, boolean>
});

let lastSig = '';
const stoppers: (() => void)[] = [];

/** Module-level AudioContext singleton — reused across all monitors to stay within browser limits. */
let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();
  }
  // Resume if suspended (browsers suspend AudioContext until a user gesture)
  if (sharedAudioContext.state === 'suspended') {
    void sharedAudioContext.resume();
  }
  return sharedAudioContext;
}

function setSpeaking(userId: string, active: boolean) {
  if (active) {
    if (voiceActivity.speaking[userId]) return;
    voiceActivity.speaking = { ...voiceActivity.speaking, [userId]: true };
  } else {
    if (!voiceActivity.speaking[userId]) return;
    const next = { ...voiceActivity.speaking };
    delete next[userId];
    voiceActivity.speaking = next;
  }
}

function startLevelMonitor(userId: string, stream: MediaStream): () => void {
  const raw = stream.getAudioTracks()[0];
  if (!raw || raw.readyState === 'ended') {
    return () => {};
  }

  const track = raw.clone();
  const ms = new MediaStream([track]);
  const ctx = getAudioContext(); // ✅ use native browser AudioContext singleton
  let src: MediaStreamAudioSourceNode | null = null;
  let analyser: AnalyserNode | null = null;
  let raf = 0;
  try {
    src = ctx.createMediaStreamSource(ms);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.45;
    src.connect(analyser);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (err) {
    track.stop();
    return () => {};
  }

  const data = new Uint8Array(analyser!.frequencyBinCount);
  let lastSpeak = 0;
  let lastReported = false;
  const threshold = 0.012;
  const holdMs = 340;

  const tick = () => {
    if (!analyser) return;
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i]! - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    const now = performance.now();
    const hot = rms > threshold;
    if (hot) lastSpeak = now;
    const active = hot || now - lastSpeak < holdMs;
    if (active !== lastReported) {
      lastReported = active;
      setSpeaking(userId, active);
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    try {
      src?.disconnect();
      analyser?.disconnect();
    } catch {
      /* ignore */
    }
    track.stop();
    setSpeaking(userId, false);
  };
}

function stopAllMonitors() {
  while (stoppers.length) {
    stoppers.pop()?.();
  }
  voiceActivity.speaking = {};
}

/**
 * (Re)start RMS monitors when streams / room membership change.
 * Uses a stable signature so position updates do not tear down analysers.
 */
export function resyncVoiceMonitors(
  players: UserClient[] | undefined,
  selfId: string,
  localMic: MediaStream | null
): () => void {
  const sig = `${selfId}|${localMic?.id ?? ''}|${(players ?? []).map((p) => `${p.id}:${p.stream?.id ?? ''}`).join('|')}`;
  if (sig === lastSig) {
    return () => {};
  }

  lastSig = sig;
  stopAllMonitors();

  for (const p of players ?? []) {
    if (p.id === selfId) continue;
    const t = p.stream?.getAudioTracks()[0];
    if (t && t.readyState === 'live') {
      stoppers.push(startLevelMonitor(p.id, p.stream!));
    }
  }

  const lt = localMic?.getAudioTracks()[0];
  if (lt && lt.readyState === 'live') {
    stoppers.push(startLevelMonitor(selfId, localMic!));
  }

  return () => {
    stopAllMonitors();
    lastSig = '';
  };
}

export function computeVoiceSig(): string {
  return (
    `${gameState.userId}|${audioUi.localMicStream?.id ?? ''}|` +
    (gameState.room.players ?? []).map((p) => `${p.id}:${p.stream?.id ?? ''}`).join('|')
  );
}

export function resyncVoiceMonitorsFromGameState(): () => void {
  if (!gameState.room.roomId) {
    return resyncVoiceMonitors(undefined, gameState.userId, audioUi.localMicStream);
  }
  return resyncVoiceMonitors(gameState.room.players, gameState.userId, audioUi.localMicStream);
}
