declare interface RTCPeerConnection {
  channel?: RTCDataChannel;
}

// add pa to window
declare interface Window {
  pa?: import('three').PositionalAudio;
  client: import('./lib/connections/PlayerWebRTC.connection').PlayerConnection;
  host: import('./lib/connections/HostWebRTC.connection').HostConnection;
}
