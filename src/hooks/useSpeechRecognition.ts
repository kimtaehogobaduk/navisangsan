import { useState, useRef, useCallback } from "react";

export interface SpeechRecognitionResult {
  transcript: string;
  isListening: boolean;
  wordCount: number;
  duration: number;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export function useSpeechRecognition(): SpeechRecognitionResult {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [duration, setDuration] = useState(0);
  const recognitionRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);

  const startListening = useCallback(() => {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("이 브라우저는 음성 인식을 지원하지 않습니다. Chrome을 사용해주세요.");
      return;
    }

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "ko-KR";

    startTimeRef.current = Date.now();
    setTranscript("");
    setWordCount(0);
    setDuration(0);

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: any) => {
      let final = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript + " ";
      }
      final = final.trim();
      setTranscript(final);
      setWordCount(final.split(/\s+/).filter(Boolean).length);
      setDuration((Date.now() - startTimeRef.current) / 1000);
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.start();
    recognitionRef.current = recognition;
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* */ }
      recognitionRef.current = null;
      setIsListening(false);
      setDuration((Date.now() - startTimeRef.current) / 1000);
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setWordCount(0);
    setDuration(0);
    startTimeRef.current = 0;
  }, []);

  return { transcript, isListening, wordCount, duration, startListening, stopListening, resetTranscript };
}
