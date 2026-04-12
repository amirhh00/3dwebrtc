export const DEFAULT_RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [
    {
      urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302']
    },
    // Fallback TURN server (free public TURN)
    {
      urls: ['turn:openrelay.metered.ca:80'],
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
};

/** Resolves when ICE gathering has finished so the local SDP includes candidates. */
export function waitForIceGatheringComplete(pc: RTCPeerConnection): Promise<void> {
  console.log(`[ICE] 🧊 Checking ICE gathering state:`, pc.iceGatheringState);
  if (pc.iceGatheringState === 'complete') {
    console.log(`[ICE] ✅ ICE already complete`);
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const MAX_WAIT_TIME = 5000; // 5 second timeout
    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      pc.removeEventListener('icegatheringstatechange', onState);
    };

    const onState = () => {
      console.log(`[ICE] 🔄 ICE gathering state changed:`, pc.iceGatheringState);
      if (pc.iceGatheringState === 'complete') {
        console.log(`[ICE] ✅ ICE gathering complete`);
        cleanup();
        resolve();
      }
    };

    // Set timeout as fallback
    const timeoutId = setTimeout(() => {
      console.warn(
        `[ICE] ⚠️ ICE gathering timeout after ${MAX_WAIT_TIME}ms. State: ${pc.iceGatheringState}`
      );
      cleanup();
      resolve(); // Resolve anyway to continue the flow
    }, MAX_WAIT_TIME);

    pc.addEventListener('icegatheringstatechange', onState);
    onState(); // Check current state immediately
  });
}
