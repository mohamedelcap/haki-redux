import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatTime, useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "convex/react";
import {
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Timer,
  TimerOff,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { create } from "zustand";

/**
 * Valid silent placeholder audio: a tiny generated WAV (no console errors,
 * unlike a truncated MP3). Replaced by real file URLs once audio is uploaded.
 */
function makeSilentWavDataUri(): string {
  const sampleRate = 8000;
  const seconds = 1;
  const samples = sampleRate * seconds;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples * 2, true);
  // silence (all zeros) — no write needed
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

export const DEMO_AUDIO = makeSilentWavDataUri();

export function demoAudioUrl(id?: string) {
  void id;
  return DEMO_AUDIO;
}

// ============ Player store ============

export type PlayerTrack = {
  contentId: Id<"content">;
  title: string;
  coverImage?: string | null;
  authorName?: string | null;
  narratorName?: string | null;
  audioUrl: string;
  /** Offset in seconds where this track begins within the content (chapter/episode mapping). */
  startOffset: number;
  /** Absolute position (in content time) to start from — used for resume. */
  startAt?: number;
};

type PlayerState = {
  track: PlayerTrack | null;
  isPlaying: boolean;
  speed: number;
  volume: number;
  muted: boolean;
  /** Sleep timer: absolute end timestamp, null = off. */
  sleepTimerEnd: number | null;
  setTrack: (t: PlayerTrack | null) => void;
  setIsPlaying: (p: boolean) => void;
  setSpeed: (s: number) => void;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  setSleepTimer: (minutes: number | null) => void;
};

export const usePlayerStore = create<PlayerState>((set) => ({
  track: null,
  isPlaying: false,
  speed: 1,
  volume: 1,
  muted: false,
  sleepTimerEnd: null,
  setTrack: (track) => set({ track, isPlaying: true }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setSpeed: (speed) => set({ speed }),
  setVolume: (volume) => set({ volume }),
  setMuted: (muted) => set({ muted }),
  setSleepTimer: (minutes) =>
    set({ sleepTimerEnd: minutes ? Date.now() + minutes * 60000 : null }),
}));

// ============ Context wrapper ============

type PlayerContextValue = {
  play: (track: PlayerTrack) => void;
  pause: () => void;
  resume: () => void;
  close: () => void;
  seek: (seconds: number) => void;
  track: PlayerTrack | null;
  isPlaying: boolean;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const track = usePlayerStore((s) => s.track);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const speed = usePlayerStore((s) => s.speed);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const setTrack = usePlayerStore((s) => s.setTrack);
  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [, setTick] = useState(0);
  const { isAuthenticated } = useAuth();
  const recordListen = useMutation(api.library.recordListen);

  const stateRef = useRef({ track, isPlaying, isAuthenticated });
  stateRef.current = { track, isPlaying, isAuthenticated };
  const lastTrackRef = useRef<PlayerTrack | null>(null);

  // Sync the audio element with store state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!track || !track.audioUrl) {
      audio.pause();
      audio.removeAttribute("src");
      lastTrackRef.current = null;
      return;
    }
    // Demo audio (data URIs) loops so the player keeps its "playing" state.
    audio.loop = track.audioUrl.startsWith("data:");
    if (audio.getAttribute("src") !== track.audioUrl) {
      audio.setAttribute("src", track.audioUrl);
      audio.load();
      // Resume support: jump to the saved position once duration is known.
      if (track.startAt && track.startAt > 0) {
        const onMeta = () => {
          audio.currentTime = Math.max(0, track.startAt! - (track.startOffset || 0));
          audio.removeEventListener("loadedmetadata", onMeta);
        };
        audio.addEventListener("loadedmetadata", onMeta);
      }
    } else if (lastTrackRef.current !== track) {
      // Same URL but a different track (e.g. switching chapters over demo audio):
      // apply the within-track position directly.
      const within = Math.max(0, (track.startAt ?? 0) - (track.startOffset || 0));
      try {
        audio.currentTime = within;
      } catch {
        /* media not seekable yet */
      }
    }
    lastTrackRef.current = track;
    audio.playbackRate = speed;
    audio.volume = muted ? 0 : volume;
    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  }, [track, isPlaying, speed, volume, muted, setIsPlaying]);

  // Save listening progress every 15 seconds while playing
  useEffect(() => {
    if (!track || !isPlaying) return;
    const id = setInterval(() => {
      const audio = audioRef.current;
      const current = stateRef.current;
      if (!audio || !current.isAuthenticated || !current.track) return;
      const pos = audio.currentTime + (current.track.startOffset || 0);
      void recordListen({
        contentId: current.track.contentId,
        position: Math.round(pos),
        duration: Math.round(audio.duration || 0),
      }).catch(() => undefined);
    }, 15000);
    return () => clearInterval(id);
  }, [track, isPlaying, recordListen]);

  const play = useCallback((t: PlayerTrack) => setTrack(t), [setTrack]);
  const pause = useCallback(() => setIsPlaying(false), [setIsPlaying]);
  const resume = useCallback(() => setIsPlaying(true), [setIsPlaying]);
  const close = useCallback(() => {
    setTrack(null);
    setIsPlaying(false);
  }, [setTrack, setIsPlaying]);
  const seek = useCallback(
    (seconds: number) => {
      if (audioRef.current) {
        audioRef.current.currentTime = Math.max(0, seconds - (track?.startOffset || 0));
      }
      setTick((t) => t + 1);
    },
    [track],
  );

  const value = useMemo<PlayerContextValue>(
    () => ({ play, pause, resume, close, seek, track, isPlaying }),
    [play, pause, resume, close, seek, track, isPlaying],
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={() => setTick((t) => t + 1)}
        onLoadedMetadata={() => setTick((t) => t + 1)}
      />
      <PlayerBar audioRef={audioRef} />
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}

// ============ Bottom player bar ============

function PlayerBar({
  audioRef,
}: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
}) {
  const { t, lang } = useLang();
  const track = usePlayerStore((s) => s.track);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const speed = usePlayerStore((s) => s.speed);
  const setSpeed = usePlayerStore((s) => s.setSpeed);
  const muted = usePlayerStore((s) => s.muted);
  const setMuted = usePlayerStore((s) => s.setMuted);
  const sleepTimerEnd = usePlayerStore((s) => s.sleepTimerEnd);
  const setSleepTimer = usePlayerStore((s) => s.setSleepTimer);
  const close = usePlayer().close;
  const [, setTick] = useState(0);

  // Sleep timer: pause playback when the countdown reaches zero.
  useEffect(() => {
    if (!sleepTimerEnd || !isPlaying) return;
    const id = setInterval(() => {
      setTick((v) => v + 1);
      if (Date.now() >= sleepTimerEnd) {
        setIsPlaying(false);
        setSleepTimer(null);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [sleepTimerEnd, isPlaying, setIsPlaying, setSleepTimer]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setTick((v) => v + 1);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onTime);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onTime);
    };
  }, [audioRef]);

  if (!track) return null;

  const audio = audioRef.current;
  const duration = audio?.duration || 0;
  const currentTime = audio?.currentTime || 0;

  const seekTo = (seconds: number) => {
    if (audio) audio.currentTime = Math.max(0, seconds - (track.startOffset || 0));
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="haki-container flex items-center gap-3 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src={track.coverImage || "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=480&h=720&fit=crop&q=80"}
            alt=""
            className="size-11 rounded-md object-cover"
            loading="lazy"
          />
          <div className="min-w-0 max-w-[140px] sm:max-w-[240px]">
            <p className="truncate text-sm font-semibold">{track.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {track.authorName || track.narratorName || ""}
            </p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center gap-1 sm:gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="رجوع 10 ثوانٍ"
            onClick={() => seekTo(currentTime - 10)}
          >
            <RotateCcw className="size-4" />
          </Button>
          <Button
            size="icon"
            aria-label={isPlaying ? t("pause") : t("play")}
            onClick={() => setIsPlaying(!isPlaying)}
            className="rounded-full"
          >
            {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="تقديم 30 ثانية"
            onClick={() => seekTo(currentTime + 30)}
            className="hidden sm:inline-flex"
          >
            <RotateCw className="size-4" />
          </Button>
        </div>

        <div className="hidden flex-1 items-center gap-2 md:flex" dir="ltr">
          <span className="w-12 text-xs tabular-nums text-muted-foreground">
            {formatTime(currentTime)}
          </span>
          <Slider
            value={[Math.min(currentTime, duration || 1)]}
            max={duration || 1}
            step={1}
            onValueChange={(vals) => seekTo(vals[0] ?? 0)}
            aria-label="شريط التقدم"
          />
          <span className="w-12 text-xs tabular-nums text-muted-foreground">
            {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            aria-label="سرعة التشغيل"
            onClick={() =>
              setSpeed(speed === 1 ? 1.25 : speed === 1.25 ? 1.5 : speed === 1.5 ? 2 : 1)
            }
            className="hidden sm:inline-flex text-xs font-bold"
          >
            {speed}x
          </Button>
          {/* Sleep timer */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="مؤقت النوم"
                className={cn(
                  "hidden sm:inline-flex text-[10px] font-bold",
                  sleepTimerEnd && "text-primary",
                )}
              >
                {sleepTimerEnd ? <Timer className="size-4" /> : <TimerOff className="size-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSleepTimer(15)}>
                {lang === "ar" ? "15 دقيقة" : "15 minutes"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSleepTimer(30)}>
                {lang === "ar" ? "30 دقيقة" : "30 minutes"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSleepTimer(60)}>
                {lang === "ar" ? "ساعة" : "1 hour"}
              </DropdownMenuItem>
              {sleepTimerEnd && (
                <DropdownMenuItem
                  onClick={() => setSleepTimer(null)}
                  className="text-destructive"
                >
                  {lang === "ar" ? "إلغاء المؤقت" : "Cancel timer"}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {sleepTimerEnd && (
            <span
              className="hidden lg:inline text-[10px] font-bold tabular-nums text-primary"
              dir="ltr"
            >
              {formatTime(Math.max(0, Math.round((sleepTimerEnd - Date.now()) / 1000)))}
            </span>
          )}

          <Button
            variant="ghost"
            size="icon"
            aria-label="الصوت"
            onClick={() => setMuted(!muted)}
            className="hidden md:inline-flex"
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </Button>
          <Button variant="ghost" size="icon" aria-label="إغلاق المشغل" onClick={close}>
            <X className="size-4" />
          </Button>
        </div>
      </div>
      {/* Mobile progress line */}
      <div className="h-0.5 w-full bg-muted md:hidden">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
        />
      </div>
    </div>
  );
}
