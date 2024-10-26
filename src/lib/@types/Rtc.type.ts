export type RTCData = {
  from: string;
  type: 'position' | 'chat';
  position?: [number, number, number];
  message?: string;
};
