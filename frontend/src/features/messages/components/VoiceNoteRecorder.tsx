'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Play, Pause, Trash2, Send, Loader2, StopCircle } from 'lucide-react';
import { toast } from 'sonner';
import { uploadDeliveryFile as uploadMessageFile, type UploadedFileAsset } from '../../delivery/upload';

interface VoiceNoteRecorderProps {
  onRecorded: (asset: UploadedFileAsset) => void;
  onCancel: () => void;
}

export default function VoiceNoteRecorder({ onRecorded, onCancel }: VoiceNoteRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Start recording automatically when mounted
  useEffect(() => {
    startRecording();
    return () => {
      stopStreams();
    };
  }, []);

  const stopStreams = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
    }
  };

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error('Voice recording is not supported in this browser.');
        onCancel();
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Setup audio visualizer
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      drawWaveform();

      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
        else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
        else mimeType = '';
      }

      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mime = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mime });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Error starting audio recording:', err);
      toast.error('Unable to access microphone. Please check permissions.');
      onCancel();
    }
  };

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 2;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        ctx.fillStyle = '#10b981'; // WhatsApp Emerald Green
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }
    };

    render();
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    }
  };

  const handleSend = async () => {
    if (!audioBlob) return;
    setIsUploading(true);
    try {
      const ext = audioBlob.type.includes('ogg') ? '.ogg' : audioBlob.type.includes('mp4') ? '.m4a' : '.webm';
      const filename = `voice-message-${Date.now()}${ext}`;
      const file = new File([audioBlob], filename, { type: audioBlob.type || 'audio/webm' });

      const uploaded = await uploadMessageFile(file, {
        entityType: 'message'
      });

      onRecorded({ ...uploaded, originalName: filename });
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload voice message');
    } finally {
      setIsUploading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="flex w-full items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-3">
        {isRecording ? (
          <div className="flex items-center gap-2">
            <span className="relative flex h-3.5 w-3.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-rose-500"></span>
            </span>
            <span className="font-mono text-xs font-black text-rose-600">
              {formatTime(recordingDuration)}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-emerald-700" />
            <span className="font-mono text-xs font-black text-emerald-800">
              Voice Note ({formatTime(recordingDuration)})
            </span>
          </div>
        )}

        {/* Live Audio Visualizer Canvas or Audio Preview */}
        {isRecording ? (
          <canvas
            ref={canvasRef}
            width={120}
            height={24}
            className="rounded bg-emerald-100/70"
          />
        ) : audioUrl ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (!audioPreviewRef.current) return;
                if (isPlayingPreview) {
                  audioPreviewRef.current.pause();
                  setIsPlayingPreview(false);
                } else {
                  audioPreviewRef.current.play();
                  setIsPlayingPreview(true);
                }
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition"
            >
              {isPlayingPreview ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </button>
            <audio
              ref={audioPreviewRef}
              src={audioUrl}
              onEnded={() => setIsPlayingPreview(false)}
              className="hidden"
            />
            <span className="text-[11px] font-semibold text-emerald-700">Preview Voice Note</span>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {/* Cancel / Trash */}
        <button
          type="button"
          onClick={() => {
            stopStreams();
            onCancel();
          }}
          disabled={isUploading}
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition"
          title="Discard voice message"
          aria-label="Discard recording"
        >
          <Trash2 className="h-4 w-4" />
        </button>

        {/* Stop recording if in progress */}
        {isRecording && (
          <button
            type="button"
            onClick={stopRecording}
            className="flex h-9 items-center gap-1.5 rounded-full bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm transition"
          >
            <StopCircle className="h-4 w-4" /> Done
          </button>
        )}

        {/* Send when recorded */}
        {!isRecording && audioBlob && (
          <button
            type="button"
            onClick={handleSend}
            disabled={isUploading}
            className="flex h-9 items-center gap-1.5 rounded-full bg-[#12335f] px-4 text-xs font-black text-white hover:bg-[#0b1f3a] shadow-sm transition disabled:opacity-50"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Send className="h-3.5 w-3.5" /> Send Voice Note
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
