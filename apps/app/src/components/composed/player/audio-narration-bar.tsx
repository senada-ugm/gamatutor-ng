import { useEffect, useRef, useState } from "react"
import { Play, Pause, RotateCcw, Volume2, VolumeX, Gauge } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Slider } from "@workspace/ui/components/slider"
import { speak } from "@/lib/speech"

interface AudioNarrationBarProps {
  transcript?: string
  audioUrl?: string
  lang?: string
  autoPlay?: boolean
  onComplete?: () => void
  onTimeUpdate?: (currentTime: number) => void
  className?: string
}

export function AudioNarrationBar({
  transcript,
  audioUrl,
  lang = "id-ID",
  autoPlay = false,
  onComplete,
  onTimeUpdate,
  className = "",
}: AudioNarrationBarProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [rate, setRate] = useState<number>(1.0)
  const [progress, setProgress] = useState<number>(0)
  const [isMuted, setIsMuted] = useState(false)

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const timerRef = useRef<number | null>(null)

  // Clean up on slide transition or unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel()
      }
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (timerRef.current) {
        window.clearInterval(timerRef.current)
      }
    }
  }, [transcript, audioUrl])

  useEffect(() => {
    if (!transcript && !audioUrl) return

    if (autoPlay) {
      handlePlay()
    }
  }, [transcript, audioUrl])

  function handlePlay() {
    if (audioUrl) {
      if (!audioRef.current) {
        audioRef.current = new Audio(audioUrl)
        audioRef.current.playbackRate = rate
        audioRef.current.muted = isMuted
        audioRef.current.onended = () => {
          setIsPlaying(false)
          setProgress(100)
          onComplete?.()
        }
        audioRef.current.ontimeupdate = () => {
          if (audioRef.current && audioRef.current.duration) {
            setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100)
            onTimeUpdate?.(audioRef.current.currentTime)
          }
        }
      }
      const playPromise = audioRef.current.play()
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true)
          })
          .catch((err) => {
            console.warn("Autoplay deferred or blocked:", err)
            setIsPlaying(false)
          })
      } else {
        setIsPlaying(true)
      }
      return
    }

    if (!transcript || typeof window === "undefined" || !("speechSynthesis" in window)) return

    const utterance = speak(transcript, { lang, rate })
    if (!utterance) return
    utteranceRef.current = utterance

    // Estimate duration based on text length: ~15 chars per sec at 1.0x
    const estimatedDurationSec = Math.max(3, transcript.length / (15 * rate))
    let elapsed = 0

    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = window.setInterval(() => {
      elapsed += 0.2
      const pct = Math.min(99, (elapsed / estimatedDurationSec) * 100)
      setProgress(pct)
    }, 200)

    utterance.onend = () => {
      setIsPlaying(false)
      setProgress(100)
      if (timerRef.current) window.clearInterval(timerRef.current)
      onComplete?.()
    }

    utterance.onerror = () => {
      setIsPlaying(false)
      if (timerRef.current) window.clearInterval(timerRef.current)
    }

    setIsPlaying(true)
  }

  function handlePause() {
    if (audioUrl && audioRef.current) {
      audioRef.current.pause()
      setIsPlaying(false)
      return
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel()
      }
      if (timerRef.current) window.clearInterval(timerRef.current)
      setIsPlaying(false)
    }
  }

  function handleReplay() {
    setProgress(0)
    onTimeUpdate?.(0)
    handlePlay()
  }

  function cycleRate() {
    const nextRate = rate === 1.0 ? 1.25 : rate === 1.25 ? 1.5 : 1.0
    setRate(nextRate)
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate
    } else if (isPlaying) {
      // Restart utterance with new rate
      handlePlay()
    }
  }

  function toggleMute() {
    const nextMuted = !isMuted
    setIsMuted(nextMuted)
    if (audioRef.current) {
      audioRef.current.muted = nextMuted
    } else if (typeof window !== "undefined" && "speechSynthesis" in window) {
      if (nextMuted) {
        window.speechSynthesis.cancel()
        setIsPlaying(false)
      } else {
        handlePlay()
      }
    }
  }

  if (!transcript && !audioUrl) {
    return null
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border bg-card/80 px-4 py-2.5 shadow-xs backdrop-blur-sm ${className}`}
    >
      <div className="flex items-center gap-1.5">
        {isPlaying ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={handlePause}
            className="h-8 w-8 p-0 text-primary hover:bg-primary/10"
            title="Pause narration"
            aria-label="Pause narration"
          >
            <Pause className="h-4 w-4 fill-current" />
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={handlePlay}
            className="h-8 w-8 p-0 text-primary hover:bg-primary/10"
            title="Play narration"
            aria-label="Play narration"
          >
            <Play className="ml-0.5 h-4 w-4 fill-current" />
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={handleReplay}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          title="Replay narration"
          aria-label="Replay narration"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex flex-1 items-center gap-3">
        <Slider
          value={[progress]}
          max={100}
          step={1}
          onValueChange={(val) => {
            const nextVal = typeof val === "number" ? val : (val[0] ?? 0)
            setProgress(nextVal)
            if (audioUrl && audioRef.current && audioRef.current.duration) {
              const nextTime = (nextVal / 100) * audioRef.current.duration
              audioRef.current.currentTime = nextTime
              onTimeUpdate?.(nextTime)
            }
          }}
          className="flex-1"
          aria-label="Narration progress scrubber"
        />
        <span className="w-10 text-right font-mono text-xs text-muted-foreground">{Math.round(progress)}%</span>
      </div>

      <div className="flex items-center gap-1.5 border-l pl-2">
        <Button
          size="sm"
          variant="outline"
          onClick={cycleRate}
          className="h-7 gap-1 px-2 font-mono text-xs font-medium"
          title={`Playback speed: ${rate}x`}
        >
          <Gauge className="h-3 w-3" />
          {rate}x
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={toggleMute}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          title={isMuted ? "Unmute" : "Mute"}
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX className="h-4 w-4 text-destructive" /> : <Volume2 className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
