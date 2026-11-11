import { useEffect, useRef, useState, type RefObject } from "react";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { toast } from "sonner";
import { trackFeature } from "@/lib/analytics/events";

/**
 * Voice input: speech recognition plus a mic analyser for the live wave.
 * `startRecording` remembers the draft so the transcript is appended to it
 * (see useTranscriptSync).
 */
export function useVoiceInput(value: string) {
  const [isRecording,   setIsRecording]   = useState(false);
  const [analyser,      setAnalyser]      = useState<AnalyserNode | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const preRecordingTextRef = useRef<string>("");

  const { transcript, resetTranscript, browserSupportsSpeechRecognition } =
    useSpeechRecognition();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close();
      SpeechRecognition.abortListening();
    };
  }, []);

  // ── Recording toggle ─────────────────────────────────────────────────────

  const startRecording = async () => {
    if (!browserSupportsSpeechRecognition) return;
    trackFeature("voice_input");
    preRecordingTextRef.current = value ?? "";
    resetTranscript();

    // Set recording state immediately for instant UI feedback.
    setIsRecording(true);
    SpeechRecognition.startListening({ continuous: true, interimResults: true });

    // Create AudioContext synchronously while still inside the user-gesture call
    // stack. If created after an `await`, Chrome starts it suspended and
    // getByteFrequencyData returns all zeros.
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Resume in case the context was auto-suspended (e.g. tab in background)
      if (ctx.state === "suspended") await ctx.resume();

      const source = ctx.createMediaStreamSource(stream);
      const analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 256;
      analyserNode.smoothingTimeConstant = 0.75;
      source.connect(analyserNode);
      setAnalyser(analyserNode);
    } catch {
      // Mic permission denied or unavailable - revert all state
      ctx.close();
      audioCtxRef.current = null;
      SpeechRecognition.abortListening();
      setIsRecording(false);
      toast.error("Microphone access denied. Please allow microphone permission to record.");
    }
  };

  const stopRecording = () => {
    SpeechRecognition.stopListening();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close();
    streamRef.current = null;
    audioCtxRef.current = null;
    setAnalyser(null);
    setIsRecording(false);
  };

  return {
    isRecording,
    analyser,
    transcript,
    preRecordingTextRef,
    browserSupportsSpeechRecognition,
    startRecording,
    stopRecording,
  };
}

/** Live transcript → textarea value during recording. */
export function useTranscriptSync(
  voice: Pick<ReturnType<typeof useVoiceInput>, "isRecording" | "transcript" | "preRecordingTextRef">,
  isControlled: boolean,
  setInternalValue: (value: string) => void,
  onChangeRef: RefObject<((value: string) => void) | undefined>,
) {
  const { transcript, isRecording, preRecordingTextRef } = voice;
  useEffect(() => {
    if (!isRecording) return;
    const base = preRecordingTextRef.current;
    const combined =
      base && transcript ? `${base} ${transcript}` : transcript || base;
    if (!isControlled) setInternalValue(combined);
    onChangeRef.current?.(combined);
  }, [transcript, isRecording, isControlled, preRecordingTextRef, setInternalValue, onChangeRef]);
}
