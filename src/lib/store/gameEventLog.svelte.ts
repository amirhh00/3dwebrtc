import type { UserClient } from '$lib/store/game.svelte';

export type LogSegment = {
  text: string;
  /** Bold label styled with `color` (player name). */
  playerName?: boolean;
  color?: string;
};

export type LogLine = {
  id: string;
  time: number;
  segments: LogSegment[];
};

const MAX_LINES = 28;

export const gameEventLog = $state({
  lines: [] as LogLine[]
});

export function formatLogTime(t: number): string {
  return new Date(t).toLocaleTimeString(undefined, {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export function displayName(p: Pick<UserClient, 'id' | 'name'> | undefined): string {
  if (!p) return 'Unknown';
  const n = p.name?.trim();
  return n || p.id;
}

export function displayColor(p: UserClient | undefined, fallback = '#a3a3a3'): string {
  const c = p?.color?.trim();
  return c || fallback;
}

function push(segments: LogSegment[]) {
  const line: LogLine = {
    id: crypto.randomUUID(),
    time: Date.now(),
    segments
  };
  gameEventLog.lines = [...gameEventLog.lines.slice(-(MAX_LINES - 1)), line];
}

export function logChat(actor: UserClient | undefined, text: string, at = Date.now()) {
  push([
    { text: `[${formatLogTime(at)}] ` },
    { text: displayName(actor), playerName: true, color: displayColor(actor) },
    { text: `: ${text}` }
  ]);
}

export function logPlayerJoined(actor: UserClient | undefined) {
  const t = Date.now();
  push([
    { text: `[${formatLogTime(t)}] ` },
    { text: displayName(actor), playerName: true, color: displayColor(actor) },
    { text: ' entered the game' }
  ]);
}

export function logPlayerLeft(actor: UserClient | undefined) {
  const t = Date.now();
  push([
    { text: `[${formatLogTime(t)}] ` },
    { text: displayName(actor), playerName: true, color: displayColor(actor) },
    { text: ' left the game' }
  ]);
}

export function logMic(actor: UserClient | undefined, enabled: boolean) {
  const t = Date.now();
  push([
    { text: `[${formatLogTime(t)}] ` },
    { text: displayName(actor), playerName: true, color: displayColor(actor) },
    { text: enabled ? ' enabled voice' : ' disabled voice' }
  ]);
}

export function logRename(actor: UserClient, prevName: string, nextName: string) {
  const t = Date.now();
  const col = displayColor(actor);
  push([
    { text: `[${formatLogTime(t)}] ` },
    { text: nextName || actor.id, playerName: true, color: col },
    { text: ' changed their name from ' },
    { text: prevName || '(empty)', playerName: true, color: col },
    { text: ' to ' },
    { text: nextName || '(empty)', playerName: true, color: col }
  ]);
}

export function logRecolor(actor: UserClient, prevColor: string, nextColor: string) {
  const t = Date.now();
  const nameCol = displayColor(actor);
  push([
    { text: `[${formatLogTime(t)}] ` },
    { text: displayName(actor), playerName: true, color: nameCol },
    { text: ' changed their color from ' },
    { text: '■ ', color: prevColor },
    { text: `${prevColor} ` },
    { text: 'to ' },
    { text: '■ ', color: nextColor },
    { text: nextColor }
  ]);
}
