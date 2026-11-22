// Voice-over per line (AU-1, mock-up 13): one take per row, recorded in the browser and kept in the script's folder
// as voice/row-<id>.webm, beside voice/row-<id>.json (who, when, how long). By the row's id, so moving a row keeps
// its take. OneDrive shares them like any asset; nothing is uploaded anywhere else.
import { cleaning, measure, rideAt, RIDE, span, type Measure } from './cleanup.svelte';
import { chosenMic, openMic } from './mic';
import { countWords } from './readtime.svelte';
import { decoder } from './voiceexport';
import { announce } from './news';
import { eachAtOnce } from './atonce';
import { subdir } from './dirs';
import { heardWords } from './timeline';
import { hear } from './hear';

// text: the dialogue as it was read, so a take whose line has changed since shows as outdated (asked by the user).
// seconds: the whole recording, as timed. from, to and gain: where the speech is and how loud (AU-4), measured when
// it was recorded; a take from before, or with nothing heard, has none and plays whole.
// words: each word the speech model heard, with when it starts (seconds from the recording's start), for cuts on a
// word (SB-8); a take not heard yet has none.
// file: the sound file it came from, when it was brought in rather than recorded (#228).
export type Take = { by: string; at: number; seconds: number; text: string; words?: [string, number][]; file?: string } & Partial<Measure>;
export type Held = { take: Take; sound: Blob }; // a take kept in memory for Undo (UX-1, UX-2)
// fellBack: the mic picked in Settings wasn't there, so the default is recording (AU-3). level: how loud the mic is
// right now, in dBFS (its loudest sample of the last moment), for the live level (AU-11).
export type Recording = { stop: () => Promise<Blob>; fellBack?: boolean; level?: () => number };

const FOLDER = 'voice';
const CUE = 1000; // ms the ring takes to fill before the cue to read
const MEASURE_RATE = 16000; // takes are decoded at this rate to find the speech and its loudness

// A file picked as a take that the browser can't read as sound (#228).
export class NotSound extends Error {
  constructor(name: string) {
    super(`${name} isn't a sound file this browser can read`);
    this.name = 'NotSound';
  }
}

// A recording from the microphone picked in Settings (or the default). Tests stand in for it, and are handed the
// picked mic's id (tests/e2e/voice.spec.ts, settings.spec.ts).
export async function record(): Promise<Recording> {
  const id = chosenMic().id;
  const fake = (window as unknown as { studioRecord?: (mic: string, noise: boolean) => Promise<Recording> }).studioRecord;
  if (fake) return fake(id, cleaning.noise);
  const { stream, fellBack } = await openMic(id, (c) => navigator.mediaDevices.getUserMedia(c), cleaning.noise);
  const recorder = new MediaRecorder(stream);
  const parts: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && parts.push(e.data);
  recorder.start();
  // The live level (AU-11): what the mic hears, before any clean-up.
  const meter = new AudioContext();
  const analyser = meter.createAnalyser();
  analyser.fftSize = 2048;
  meter.createMediaStreamSource(stream).connect(analyser);
  const samples = new Float32Array(analyser.fftSize);
  return {
    fellBack,
    level: () => {
      analyser.getFloatTimeDomainData(samples);
      let top = 0;
      for (const v of samples) top = Math.max(top, Math.abs(v));
      return top > 0 ? 20 * Math.log10(top) : -Infinity;
    },
    stop: () =>
      new Promise((resolve) => {
        recorder.onstop = () => {
          meter.close().catch(() => {});
          stream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(parts, { type: recorder.mimeType || 'audio/webm' }));
        };
        recorder.stop();
      }),
  };
}

// A take is outdated once its row's dialogue no longer reads as it did (spaces at the ends don't count).
export function outdated(take: Take, dialogue: string): boolean {
  return take.text.trim() !== dialogue.trim();
}

// Words a minute of a take: the words it read (its `text`), not the row as it reads now, so editing the line
// doesn't change the figure. `dialogue` only stands in for a take saved without its text. 0 when nothing to measure.
// Over the cropped length when cropping is on.
export function wpm(take: Take, dialogue: string): number {
  const words = countWords(take.text.trim() ? take.text : dialogue);
  const seconds = span(take).seconds;
  return words && seconds > 0 ? Math.round((words / seconds) * 60) : 0;
}

// How long a take plays: cropped or whole, as set in Settings.
export const takeLength = (take: Take): number => span(take).seconds;

// How long a row lasts on the timeline, in Play and in the Resolve / Premiere export: its take, or without one its
// dialogue's read time at `wpm` words a minute. With a heard take, also when each word is said (SB-8).
export function rowLength(takes: Record<string, Take>, wpm: number) {
  return (row: { id: string; dialogue: string }) => {
    const take = takes[row.id];
    if (!take) return { seconds: (countWords(row.dialogue) / wpm) * 60, take: false };
    const { from, seconds } = span(take);
    // Where each word falls, as heard in the take (SB-8); else the timeline estimates it.
    return { seconds, take: true, words: take.words ? heardWords(row.dialogue, take.words, from, seconds) : null };
  };
}

// A take's sound, ready to play its cropped part at its gain and ride (as set in Settings). Through Web Audio, so the
// crop is exact and the gain can go above 1 and follow the ride. Pause and carry on by suspending its own context.
export class Sound {
  onended: (() => void) | null = null;
  duration: number; // seconds it plays
  #ctx: AudioContext;
  #source: AudioBufferSourceNode;
  #from: number;
  #gain: number;
  #ride: number[] | null;
  #level: GainNode;
  #started = false;
  #at = 0; // the context's time when it started

  private constructor(ctx: AudioContext, buffer: AudioBuffer, take: Take) {
    const { from, to, gain, ride } = span(take);
    this.#ctx = ctx;
    this.#from = from;
    this.#gain = gain;
    this.#ride = ride;
    this.duration = Math.max(0, Math.min(buffer.duration, to ?? buffer.duration) - from);
    const level = (this.#level = ctx.createGain());
    level.gain.value = gain;
    level.connect(ctx.destination);
    this.#source = ctx.createBufferSource();
    this.#source.buffer = buffer;
    this.#source.connect(level);
    this.#source.onended = () => this.onended?.();
  }

  // Throws when the file can't be read or decoded (still syncing).
  static async open(file: File, take: Take): Promise<Sound> {
    const ctx = new AudioContext();
    try {
      return new Sound(ctx, await ctx.decodeAudioData(await file.arrayBuffer()), take);
    } catch (e) {
      ctx.close();
      throw e;
    }
  }

  // Seconds into the take.
  get time() { return this.#started ? Math.min(this.duration, this.#ctx.currentTime - this.#at) : 0; }

  // From `offset` seconds into the take the first time (a playhead dropped part way through a row, #207).
  async play(offset = 0) {
    if (!this.#started) {
      const skip = Math.min(Math.max(0, offset), this.duration);
      this.#started = true;
      this.#at = this.#ctx.currentTime - skip;
      this.#source.start(0, this.#from + skip, this.duration - skip);
      this.#follow(skip);
    }
    await this.#ctx.resume();
  }

  pause() { this.#ctx.suspend(); }

  // The ride (AU-11), as points on the gain from `skip` seconds into the take: the context's clock stops while paused,
  // so they stay in step with the sound.
  #follow(skip: number) {
    const ride = this.#ride;
    if (!ride) return;
    const gain = this.#level.gain;
    const now = this.#ctx.currentTime;
    gain.setValueAtTime(this.#gain * rideAt(ride, this.#from + skip), now);
    for (let i = 0; i < ride.length; i++) {
      const t = (i + 0.5) * RIDE - this.#from; // seconds into the take
      if (t > skip && t < this.duration) gain.linearRampToValueAtTime(this.#gain * ride[i], now + t - skip);
    }
  }

  close() {
    this.onended = null;
    this.#source.onended = null;
    this.#ctx.close().catch(() => {});
  }
}

// Where the speech is in a recording and how loud, or null when it can't be read or nothing is heard.
async function measureTake(blob: Blob): Promise<Measure | null> {
  try {
    return measure(await decoder(MEASURE_RATE)(await blob.arrayBuffer()), MEASURE_RATE);
  } catch {
    return null;
  }
}

// The sound of a row's take. Throws when there is none (or it hasn't synced yet).
export async function takeFile(dir: FileSystemDirectoryHandle, id: string): Promise<File> {
  return (await (await subdir(dir, FOLDER)).getFileHandle(`row-${id}.webm`)).getFile();
}

// Each folder's take notes read so far, by file name, with the file's date and size when read: a note is opened again
// only when they change (a new take of the row), not on every 5 s check. Null for one that isn't a take.
const read = new WeakMap<FileSystemDirectoryHandle, Map<string, { stamp: string; take: Take | null }>>();

// The takes in a script's folder, by row id (the script list reads them too, for each script's length).
export async function readTakes(dir: FileSystemDirectoryHandle): Promise<Record<string, Take>> {
  const takes: Record<string, Take> = {};
  const had = read.get(dir);
  const known = new Map<string, { stamp: string; take: Take | null }>();
  try {
    const voice = await subdir(dir, FOLDER);
    const found: [string, string, FileSystemFileHandle][] = [];
    for await (const [name, handle] of voice.entries()) {
      const id = name.match(/^row-(.+)\.json$/)?.[1];
      if (id && handle.kind === 'file') found.push([name, id, handle as FileSystemFileHandle]);
    }
    // Eight at a time (PF-10): a take's date and size are a call each on the drive.
    await eachAtOnce(found, async ([name, id, handle]) => {
      try {
        const file = await handle.getFile();
        const stamp = `${file.lastModified} ${file.size}`;
        const take = had?.get(name)?.stamp === stamp ? had.get(name)!.take : readTake(await file.text());
        known.set(name, { stamp, take });
        if (take) takes[id] = take;
      } catch {
        // Half-synced: read next time.
      }
    });
  } catch {
    // No voice folder yet.
  }
  read.set(dir, known);
  return takes;
}

function readTake(text: string): Take | null {
  const take = JSON.parse(text);
  if (typeof take.seconds !== 'number') return null;
  const found: Take = { by: String(take.by ?? ''), at: Number(take.at) || 0, seconds: take.seconds, text: String(take.text ?? '') };
  if ([take.from, take.to, take.gain].every((n) => typeof n === 'number')) Object.assign(found, { from: take.from, to: take.to, gain: take.gain });
  // AU-11: the ride, kept only if every step is a number.
  if (found.gain && Array.isArray(take.ride) && take.ride.length && take.ride.every((n: unknown) => typeof n === 'number' && n > 0)) found.ride = take.ride;
  // SB-8: the heard words, kept only if every one is a word and a time.
  if (Array.isArray(take.words) && take.words.every((w: unknown) => Array.isArray(w) && typeof w[0] === 'string' && typeof w[1] === 'number'))
    found.words = take.words;
  if (typeof take.file === 'string' && take.file) found.file = take.file;
  return found;
}

// The takes' speed together, in words a minute (Settings offers it as the speaking speed, AP-12). 0 with none.
export function takesSpeed(takes: Record<string, Take>): number {
  let words = 0;
  let seconds = 0;
  for (const take of Object.values(takes)) {
    const n = countWords(take.text);
    const length = takeLength(take);
    if (n && length > 0) (words += n), (seconds += length);
  }
  return seconds ? Math.round((words / seconds) * 60) : 0;
}

// The takes in a script's folder, by row id. Kept as state: the Editor makes one, Write and the top bar read it.
export class VoiceOver {
  takes = $state<Record<string, Take>>({});
  recording = $state(''); // the row being recorded
  started = $state(0); // when it started (ms), for the running clock
  cue = $state(false); // the first second of a take, before the cue to read (AU-4)
  playing = $state(''); // the row being played
  at = $state(0); // how far it has played, 0 to 1
  #take: Recording | null = null;
  #sound: Sound | null = null;
  #cue: ReturnType<typeof setTimeout> | undefined;

  async load(dir: FileSystemDirectoryHandle) {
    const next = await readTakes(dir);
    if (JSON.stringify(next) !== JSON.stringify(this.takes)) this.takes = next;
  }

  // How loud the mic is right now while recording, in dBFS (AU-11); null when not known (or not recording).
  level(): number | null {
    return this.#take?.level?.() ?? null;
  }

  // Takes measured before AU-11 (no ride) are measured again, one at a time, and their notes kept, so they even out
  // too. Once per take a visit: one that can't be read or has nothing heard isn't tried again until the next.
  #levelled = new Set<string>();
  #levelling = false;
  async levelAll(dir: FileSystemDirectoryHandle) {
    if (this.#levelling) return;
    this.#levelling = true;
    try {
      for (;;) {
        const id = Object.keys(this.takes).find((id) => !this.takes[id].ride && !this.#levelled.has(id) && id !== this.recording);
        if (!id) return;
        this.#levelled.add(id);
        const take = this.takes[id];
        const found = await measureTake(await takeFile(dir, id).catch(() => new Blob()));
        const now = this.takes[id];
        if (!found || !now || now.at !== take.at) continue;
        const next = { ...now, ...found };
        await write(await subdir(dir, FOLDER), `row-${id}.json`, JSON.stringify(next));
        await announce(dir, 'take');
        this.takes = { ...this.takes, [id]: next };
      }
    } catch {
      // The folder can't be written (read-only, or access lost): left for the next visit.
    } finally {
      this.#levelling = false;
    }
  }

  // True when the mic picked in Settings wasn't there and the default is recording instead.
  async start(id: string): Promise<boolean> {
    this.stopPlaying();
    this.#take = await record();
    this.recording = id;
    this.started = Date.now();
    // Recording from the click; a ring fills around the mic for a second, then it turns into ■, the cue to read.
    // The second before is cropped off with the rest of the silence.
    this.cue = true;
    clearTimeout(this.#cue);
    this.#cue = setTimeout(() => (this.cue = false), CUE);
    return !!this.#take.fellBack;
  }

  // Esc while the ring fills: the new take is thrown away and the old one kept.
  async cancel() {
    const take = this.#take;
    this.#take = null;
    this.#end();
    await take?.stop().catch(() => {});
  }

  #end() {
    clearTimeout(this.#cue);
    this.cue = false;
    this.recording = '';
  }

  // text: the row's dialogue now, kept with the take.
  async stop(dir: FileSystemDirectoryHandle, by: string, text: string) {
    const id = this.recording;
    if (!id || !this.#take) return;
    const seconds = Math.max(0.1, (Date.now() - this.started) / 1000);
    const blob = await this.#take.stop();
    this.#take = null;
    this.#end();
    const take: Take = { by, at: Date.now(), seconds: Math.round(seconds * 10) / 10, text };
    const found = await measureTake(blob);
    if (found) Object.assign(take, found);
    await this.#keep(dir, id, blob, take);
  }

  // A sound file used as a row's take (#228, board 85): copied in like a recording, measured for the clean-up and
  // heard for cuts on a word the same way, with its name kept. Throws `NotSound` when it can't be decoded.
  async useFile(dir: FileSystemDirectoryHandle, id: string, file: File, by: string, text: string) {
    let samples: Float32Array;
    try {
      samples = await decoder(MEASURE_RATE)(await file.arrayBuffer());
    } catch {
      throw new NotSound(file.name);
    }
    if (!samples.length) throw new NotSound(file.name);
    if (this.playing === id) this.stopPlaying();
    const take: Take = { by, at: Date.now(), seconds: Math.round((samples.length / MEASURE_RATE) * 10) / 10, text, file: file.name };
    const found = measure(samples, MEASURE_RATE);
    if (found) Object.assign(take, found);
    await this.#keep(dir, id, file, take);
  }

  // Writes a new take's sound and note, and tells the others.
  async #keep(dir: FileSystemDirectoryHandle, id: string, sound: Blob, take: Take) {
    const voice = await subdir(dir, FOLDER, true);
    await write(voice, `row-${id}.webm`, sound);
    await write(voice, `row-${id}.json`, JSON.stringify(take));
    await announce(dir, 'take');
    this.takes = { ...this.takes, [id]: take };
  }

  async play(dir: FileSystemDirectoryHandle, id: string) {
    if (this.playing === id) return this.stopPlaying();
    this.stopPlaying();
    const turn = this.#turn;
    const take = this.takes[id];
    const sound = await Sound.open(await takeFile(dir, id), take ?? { by: '', at: 0, seconds: 0, text: '' });
    // Another click (or a stop) while this one loaded: the newer one wins. Two at once made two clocks fight
    // over the bar, which flickered (#265).
    if (turn !== this.#turn) return sound.close();
    this.#sound = sound;
    this.#tick = setInterval(() => (this.at = sound.duration ? Math.min(1, sound.time / sound.duration) : 0), 100);
    sound.onended = () => this.stopPlaying();
    this.playing = id;
    this.at = 0;
    await sound.play();
  }

  #tick: ReturnType<typeof setInterval> | undefined;
  #turn = 0; // goes up with every play and stop, so a take that loads late is dropped

  stopPlaying() {
    this.#turn++;
    clearInterval(this.#tick);
    this.#sound?.close();
    this.#sound = null;
    this.playing = '';
    this.at = 0;
  }

  // Dismiss "Outdated" (AU-8): the line was edited to match what the take says, so its text becomes the line as it
  // reads now. Kept in the JSON, so everyone sees it, wpm counts the new words, and the next edit shows Outdated again.
  async current(dir: FileSystemDirectoryHandle, id: string, text: string) {
    const take = this.takes[id];
    if (!take) return;
    const next = { ...take, text };
    await write(await subdir(dir, FOLDER), `row-${id}.json`, JSON.stringify(next));
    await announce(dir, 'take');
    this.takes = { ...this.takes, [id]: next };
  }

  // Cuts timed from the take (SB-8): the speech model hears these rows' takes, one at a time, and each take's words
  // are kept in its JSON, so it is heard once for everyone. A take recorded again meanwhile is left for next time.
  // After a failure (no download, no model) nothing more is tried until the script is opened again.
  hearing = $state(''); // the row whose take is being heard
  failed = $state(false);
  #queue: string[] = [];
  hearAll(dir: FileSystemDirectoryHandle, ids: string[]) {
    this.#queue = ids.filter((id) => id !== this.hearing);
    if (!this.hearing && !this.failed) void this.#next(dir);
  }

  async #next(dir: FileSystemDirectoryHandle): Promise<void> {
    const id = this.#queue.shift();
    if (!id) return;
    const take = this.takes[id];
    if (!take || take.words) return this.#next(dir);
    this.hearing = id;
    try {
      const words = await hear(await takeFile(dir, id));
      const now = this.takes[id];
      if (now && now.at === take.at) {
        const next = { ...now, words };
        await write(await subdir(dir, FOLDER), `row-${id}.json`, JSON.stringify(next));
        await announce(dir, 'take');
        this.takes = { ...this.takes, [id]: next };
      }
    } catch {
      this.failed = true;
      this.#queue = [];
    } finally {
      this.hearing = '';
    }
    await this.#next(dir);
  }

  // Undo (UX-1, UX-2): a row's take as it is now, its sound read into memory so it can be written back after a delete
  // or a new take. Null when the row has none (or it can't be read).
  async hold(dir: FileSystemDirectoryHandle, id: string): Promise<Held | null> {
    const take = this.takes[id];
    if (!take) return null;
    try {
      const file = await takeFile(dir, id);
      return { take, sound: new Blob([await file.arrayBuffer()], { type: file.type }) };
    } catch {
      return null;
    }
  }

  // Writes a held take back as it was (Undo).
  async putBack(dir: FileSystemDirectoryHandle, id: string, held: Held) {
    if (this.playing === id) this.stopPlaying();
    const voice = await subdir(dir, FOLDER, true);
    await write(voice, `row-${id}.webm`, held.sound);
    await write(voice, `row-${id}.json`, JSON.stringify(held.take));
    await announce(dir, 'take');
    this.takes = { ...this.takes, [id]: held.take };
  }

  async remove(dir: FileSystemDirectoryHandle, id: string) {
    if (this.playing === id) this.stopPlaying();
    const voice = await subdir(dir, FOLDER);
    for (const name of [`row-${id}.webm`, `row-${id}.json`]) await voice.removeEntry(name).catch(() => {});
    await announce(dir, 'take');
    const { [id]: _, ...rest } = this.takes;
    this.takes = rest;
  }
}

async function write(dir: FileSystemDirectoryHandle, name: string, data: Blob | string) {
  const writable = await (await dir.getFileHandle(name, { create: true })).createWritable();
  await writable.write(data);
  await writable.close();
}
