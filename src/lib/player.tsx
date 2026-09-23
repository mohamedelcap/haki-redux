import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatTime, useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "convex/react";
import {
  Pause,
  Play,
  RotateCcw,
  RotateCw,
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

// Silent 1-second MP3 placeholder (replace with real CDN URLs when audio is uploaded).
export const DEMO_AUDIO =
  "data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAAAAAWWluZXYAAAA5AAAAtAAA5AAABGBdXVlbAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

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
};

type PlayerState = {
  track: PlayerTrack | null;
  isPlaying: boolean;
  speed: number;
  volume: number;
  muted: boolean;
  setTrack: (t: PlayerTrack | null) => void;
  setIsPlaying: (p: boolean) => void;
  setSpeed: (s: number) => void;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
};

export const usePlayerStore = create<PlayerState>((set) => ({
  track: null,
  isPlaying: false,
  speed: 1,
  volume: 1,
  muted: false,
  setTrack: (track) => set({ track, isPlaying: true }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setSpeed: (speed) => set({ speed }),
  setVolume: (volume) => set({ volume }),
  setMuted: (muted) => set({ muted }),
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

  // Sync the audio element with store state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!track || !track.audioUrl) {
      audio.pause();
      audio.removeAttribute("src");
      return;
    }
    if (audio.getAttribute("src") !== track.audioUrl) {
      audio.setAttribute("src", track.audioUrl);
      audio.load();
    }
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
  const { t } = useLang();
  const track = usePlayerStore((s) => s.track);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const speed = usePlayerStore((s) => s.speed);
  const setSpeed = usePlayerStore((s) => s.setSpeed);
  const muted = usePlayerStore((s) => s.muted);
  const setMuted = usePlayerStore((s) => s.setMuted);
  const close = usePlayer().close;
  const [, setTick] = useState(0);

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
            src={track.coverImage || "/logo.svg"}
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
