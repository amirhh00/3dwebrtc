import { postgresClient } from './db.ts';

export type ChannelMap = {
  [key: `sdp_${string}`]: string;
  [key: `room_${string}`]: { id: string; sdp: string };
};

type ListenerConfig<Channel extends keyof ChannelMap> = {
  channel: Channel;
  onNotify: (payload: ChannelMap[Channel]) => void;
  onListen?: () => void;
};

export const getDBListener = <Channel extends keyof ChannelMap>(props: ListenerConfig<Channel>) => {
  return postgresClient.listen(props.channel, (payloadString) => {
    const payload = JSON.parse(payloadString) as ChannelMap[Channel];
    props.onNotify(payload);
  });
};
