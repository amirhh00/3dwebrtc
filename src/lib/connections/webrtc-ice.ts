export const DEFAULT_RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [
    // Primary STUN servers - fast, reliable
    {
      urls: [
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302',
        'stun:stun.l.google.com:19302'
      ]
    },
    // Twilio STUN servers (ultra-reliable)
    {
      urls: ['stun:stun.twilio.com:3478']
    },
    // Primary TURN servers
    {
      urls: ['turn:openrelay.metered.ca:80'],
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: ['turn:openrelay.metered.ca:443?transport=tcp'],
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ],
  iceCandidatePoolSize: 10
};

/** Resolves when ICE gathering has finished so the local SDP includes candidates. */
export function waitForIceGatheringComplete(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const MAX_WAIT_TIME = 3000; // 5 second timeout
    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      pc.removeEventListener('icegatheringstatechange', onState);
    };

    const onState = () => {
      if (pc.iceGatheringState === 'complete') {
        cleanup();
        resolve();
      }
    };

    // Set timeout as fallback
    const timeoutId = setTimeout(() => {
      cleanup();
      resolve(); // Resolve anyway to continue the flow
    }, MAX_WAIT_TIME);

    pc.addEventListener('icegatheringstatechange', onState);
    onState(); // Check current state immediately
  });
}
