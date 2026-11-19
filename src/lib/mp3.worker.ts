// Encodes the voice-over's .mp3 (#237) off the page: about 20 s for 13 minutes of takes, which would freeze it.
import { encodeMp3 } from './mp3';

self.onmessage = (e: MessageEvent<{ clips: Float32Array[]; rate: number; gap: number }>) => {
  const { clips, rate, gap } = e.data;
  self.postMessage(encodeMp3(clips, rate, gap));
};
