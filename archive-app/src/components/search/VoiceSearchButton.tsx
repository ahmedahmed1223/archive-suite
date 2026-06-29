import { Mic, MicOff } from "lucide-react";
import * as React from "react";

import {
  extractSpeechTranscript,
  getSpeechRecognitionConstructor,
  isVoiceSearchSupported,
  parseVoiceSearchIntent
} from "../../features/search/voiceSearch.js";

export function VoiceSearchButton({
  className = "",
  disabled = false,
  lang = "ar-SA",
  onError,
  onIntent,
  onUnsupported
}: any) {
  const [isListening, setIsListening] = React.useState(false);
  const recognitionRef = React.useRef(null);
  const supported = isVoiceSearchSupported(globalThis as any);

  React.useEffect(() => () => {
    try {
      (recognitionRef.current as any)?.abort?.();
    } catch {
      // Cleanup should never block unmount.
    }
  }, []);

  const startListening = () => {
    if (disabled || isListening) return;
    const Recognition = getSpeechRecognitionConstructor(globalThis as any);
    if (!Recognition) {
      onUnsupported?.();
      return;
    }

    try {
      const recognition = new (Recognition as any)();
      recognition.lang = lang;
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;
      recognitionRef.current = recognition;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };
      recognition.onerror = (event: any) => {
        setIsListening(false);
        onError?.(event?.error || "speech-error");
      };
      recognition.onresult = (event: any) => {
        const transcript = extractSpeechTranscript(event);
        const intent = parseVoiceSearchIntent(transcript);
        if (intent.kind !== "empty") onIntent?.(intent);
      };

      recognition.start();
    } catch (error: any) {
      setIsListening(false);
      recognitionRef.current = null;
      onError?.(error?.message || "speech-start-failed");
    }
  };

  const label = supported
    ? isListening ? "جار الاستماع للبحث الصوتي" : "بدء البحث الصوتي"
    : "البحث الصوتي غير متاح";
  const Icon = supported ? Mic : MicOff;

  return (
    <button
      type="button"
      onClick={startListening}
      disabled={disabled || isListening}
      aria-label={label}
      aria-pressed={isListening}
      title={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-gray-400 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50 ${supported ? "" : "opacity-70"} ${className}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

export default VoiceSearchButton;
