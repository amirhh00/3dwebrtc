import { writable } from 'svelte/store';
import { persistent } from '$lib/persist';

export const isPaused = writable(true);

export const gameSettings = persistent('gameSettings', {
  mic: false,
  mute: false,
  playerName: '',
  playerColor: '#000000'
});
