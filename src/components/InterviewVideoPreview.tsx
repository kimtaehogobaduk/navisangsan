import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Video, VideoOff } from "lucide-react";

export interface VideoPreviewHandle {
  captureFrame: () => string | null;
  startRecording: () => void;
  stopRecording: () => Promise<Blob | null>;
  isRecording: boolean;
}

const InterviewVideoPreview = forwardRef<VideoPreviewHandle>((_, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  async function startVideo() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      if (videoRef.current) videoRef.current.srcObject = s;
      setStream(s);
      setIsActive(true);
    } catch {
      alert("카메라 접근 권한이 필요합니다.");
    }
  }

  function stopVideo() {
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setStream(null);
    setIsActive(false);
  }

  function captureFrame(): string | null {
    if (!videoRef.current || !isActive) return null;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.8);
  }

  function startRecording() {
    if (!stream) return;
    chunksRef.current = [];
    const mr = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.start(1000);
    mediaRecorderRef.current = mr;
    setIsRecording(true);
  }

  function stopRecording(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || !isRecording) { resolve(null); return; }
      mediaRecorderRef.current.onstop = () => {
        resolve(new Blob(chunksRef.current, { type: "video/webm" }));
        setIsRecording(false);
      };
      mediaRecorderRef.current.stop();
    });
  }

  useImperativeHandle(ref, () => ({ captureFrame, startRecording, stopRecording, isRecording }));

  useEffect(() => () => { stream?.getTracks().forEach((t) => t.stop()); }, [stream]);

  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">카메라</span>
          {isRecording && (
            <span className="flex items-center gap-1 text-xs text-red-400 animate-pulse">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400" /> 녹화 중
            </span>
          )}
        </div>
        <button
          onClick={isActive ? stopVideo : startVideo}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
            isActive
              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
              : "bg-brand/20 text-brand hover:bg-brand/30"
          }`}
        >
          {isActive ? <><VideoOff className="h-3.5 w-3.5" /> 끄기</> : <><Video className="h-3.5 w-3.5" /> 켜기</>}
        </button>
      </div>
      <div className="relative bg-black/40 aspect-[4/3]">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        {!isActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Video className="h-10 w-10 opacity-40" />
            <p className="text-xs">카메라를 켜서 자세를 확인하세요</p>
          </div>
        )}
      </div>
    </div>
  );
});

InterviewVideoPreview.displayName = "InterviewVideoPreview";
export default InterviewVideoPreview;
