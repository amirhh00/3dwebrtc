import { AudioContext } from 'three';
import type { UserClient } from '$lib/store/game.svelte';
import { audioUi, gameState } from '$lib/store/game.svelte';

/** True while RMS voice energy is above threshold (Discord-style indicator). */
export const voiceActivity = $state({
  speaking: {} as Record<string, boolean>
});

let lastSig = '';
const stoppers: (() => void)[] = [];

function setSpeaking(userId: string, active: boolean) {
  if (active) {
    if (voiceActivity.speaking[userId]) return;
    console.log(`[VOICE] 🔊 ${userId} started speaking`);
    voiceActivity.speaking = { ...voiceActivity.speaking, [userId]: true };
  } else {
    if (!voiceActivity.speaking[userId]) return;
    console.log(`[VOICE] 🔇 ${userId} stopped speaking`);
    const next = { ...voiceActivity.speaking };
    delete next[userId];
    voiceActivity.speaking = next;
  }
}

function startLevelMonitor(userId: string, stream: MediaStream): () => void {
  console.log(`[VOICE] 📊 Starting level monitor for ${userId}`);
  const raw = stream.getAudioTracks()[0];
  if (!raw || raw.readyState === 'ended') {
    console.warn(`[VOICE] ⚠️ Track not ready for ${userId}`);
    return () => {};
  }

  const track = raw.clone();
  const ms = new MediaStream([track]);
  const ctx = AudioContext.getContext();
  let src: MediaStreamAudioSourceNode | null = null;
  let analyser: AnalyserNode | null = null;
  let raf = 0;
  try {
    src = ctx.createMediaStreamSource(ms);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.45;
    src.connect(analyser);
    console.log(`[VOICE] ✅ Analyser connected for ${userId}`);
  } catch (e) {
    console.error('[VOICE] ❌ failed to attach analyser', userId, e);
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
    console.log(`[VOICE] ⏭️ Voice monitor signature unchanged, skipping resync`);
    return () => {};
  }

  console.log(
    `[VOICE] 🔄 Resyncing voice monitors. Players: ${players?.length ?? 0}, has local mic: ${!!localMic}`
  );
  lastSig = sig;
  stopAllMonitors();

  for (const p of players ?? []) {
    if (p.id === selfId) continue;
    const t = p.stream?.getAudioTracks()[0];
    if (t && t.readyState === 'live') {
      console.log(`[VOICE] ✅ Starting monitor for remote player ${p.id}`);
      stoppers.push(startLevelMonitor(p.id, p.stream!));
    } else {
      console.log(`[VOICE] ⏭️ Skipping ${p.id} - no stream or track not live`);
    }
  }

  const lt = localMic?.getAudioTracks()[0];
  if (lt && lt.readyState === 'live') {
    console.log(`[VOICE] ✅ Starting monitor for local mic`);
    stoppers.push(startLevelMonitor(selfId, localMic!));
  } else if (localMic) {
    console.log(`[VOICE] ⏭️ Local mic exists but track not live`);
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
