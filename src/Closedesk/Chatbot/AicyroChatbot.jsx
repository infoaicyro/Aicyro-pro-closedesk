// src/Closedesk/Chatbot/AicyroChatbot.jsx
"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowRight, Camera, Check, Image as ImageIcon, MessageSquareMore, Mic, Phone, PhoneOff, RefreshCw, Volume2, VolumeX, X } from "lucide-react";
import { logToFirebase, queueEmailAlert } from "../../lib/notificationHelper";
import { db, storage } from "../../lib/firebase";
import { ref, get } from "firebase/database";
import { ref as storageRef, uploadString, getDownloadURL } from "firebase/storage";
import { trackChatOpened, trackConversationStarted } from "../../lib/activityTracker";
import { getOrCreateAnonId } from "../../lib/cookiePersonalization";

import { createAiLogger, createVoiceLogger } from "../../lib/loggerPresets";
import { generateCorrelationId, fetchWithTrace } from "../../lib/tracer";

const uiLogger = createAiLogger("ChatbotWidget");
const voiceLogger = createVoiceLogger("VoiceAgent");

const AVATAR_MAP = {
  ai_spark: "/avatars/ai-spark.svg", bot_classic: "/avatars/bot-classic.svg",
  human_agent: "/avatars/human-agent.svg", minimal_dot: "/avatars/minimal-dot.svg",
};

const INDUSTRY_DEMOS = {
  Plumbing: { service: "Plumbing repair", scenario: "Someone has a leaking pipe." },
  HVAC: { service: "AC repair", scenario: "Someone's AC stopped working." },
  Electrical: { service: "Electrical repair", scenario: "Someone has an electrical fault or safety concern." },
  "Pest Control": { service: "Pest inspection", scenario: "Someone needs pest treatment or an inspection." },
  Roofing: { service: "Roof inspection", scenario: "Someone has storm damage or a roof leak." },
  Restoration: { service: "Water damage restoration", scenario: "Someone has water damage or flooding." },
  "Garage Door": { service: "Garage door repair", scenario: "Someone's garage door is stuck or broken." },
  "Appliance Repair": { service: "Appliance repair", scenario: "Someone's refrigerator or washer broke down." },
  "Wellness / Fitness": { service: "Session booking", scenario: "Someone wants to book a session or consultation." },
  "Sauna / Recovery": { service: "Recovery session", scenario: "Someone wants to book a sauna or recovery session." },
  "Med Spa / IV Therapy": { service: "Treatment booking", scenario: "Someone wants to book an IV therapy or spa treatment." },
  Other: { service: "Service inquiry", scenario: "Someone needs help with your service." },
};

function getReadableDeviceName() {
  if (typeof window === "undefined") return "Unknown Device";
  const ua = navigator.userAgent;
  let os = "Unknown OS", type = "Desktop";
  if (/Windows/i.test(ua)) os = "Windows PC";
  else if (/Macintosh|Mac OS X/i.test(ua)) os = "Macintosh";
  else if (/Android/i.test(ua)) { os = "Android"; type = "Mobile"; } 
  else if (/iPhone|iPad|iPod/i.test(ua)) { os = "iOS Device"; type = "Mobile"; } 
  else if (/Linux/i.test(ua)) os = "Linux";
  if (/Tablet|iPad/i.test(ua)) type = "Tablet";
  return `${os} (${type})`;
}

function getNextWeekdays() {
  const dates = [];
  let d = new Date(), daysFound = 0;
  while (daysFound < 6) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) {
      dates.push(d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));
      daysFound++;
    }
  }
  return dates;
}

const generateTimeSlots = () => {
  const slots = [];
  for (let i = 9; i <= 17; i++) {
    const hour = i > 12 ? i - 12 : i;
    const ampm = i >= 12 ? "PM" : "AM";
    slots.push(`${hour < 10 ? `0${hour}` : hour}:00 ${ampm}`);
  }
  return slots;
};

// Client-side image compression
async function compressImage(file, maxDimension = 1024, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

const STEPS = {
  WELCOME: "WELCOME", AI_CHAT_MODE: "AI_CHAT_MODE", CHOOSE_PATH: "CHOOSE_PATH",
  SELECT_DATE: "SELECT_DATE", SELECT_TIME: "SELECT_TIME", CONFIRM_BOOKING: "CONFIRM_BOOKING", FINAL_CTA: "FINAL_CTA",
};

const TypewriterBubble = ({ msg, onButtonClick, scrollRef, isProcessing, onSpeak, isMuted, agentMode, setAnimatingIds }) => {
  const [displayedText, setDisplayedText] = useState(msg.instant ? msg.text : "");
  const [isTypingText, setIsTypingText] = useState(!msg.instant);
  const hasSpoken = useRef(false);
  const isMutedRef = useRef(isMuted);
  const onSpeakRef = useRef(onSpeak);

  useEffect(() => { isMutedRef.current = isMuted; onSpeakRef.current = onSpeak; }, [isMuted, onSpeak]);
  useEffect(() => { uiLogger.info("ui_render", "widget_loaded", { context: { message: "Chatbot initialized" } }); }, []);
  useEffect(() => { if (msg.instant) setDisplayedText(msg.text); }, [msg.text, msg.instant]);

  useEffect(() => {
    const handleGlobalError = (event) => {
      uiLogger.critical("system_event", "frontend_javascript_error", {
        error: { message: event.message, filename: event.filename, lineno: event.lineno, colno: event.colno },
        context: { message: "Uncaught frontend exception detected" }
      });
    };
    const handleUnhandledRejection = (event) => {
      uiLogger.critical("system_event", "frontend_promise_rejection", {
        error: { message: String(event.reason) },
        context: { message: "Unhandled promise rejection detected" }
      });
    };

    window.addEventListener("error", handleGlobalError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => {
      window.removeEventListener("error", handleGlobalError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    if (msg.instant) {
      setIsTypingText(false);
      if (!msg.spoken && !isMutedRef.current && onSpeakRef.current && !hasSpoken.current && agentMode === "text") {
        hasSpoken.current = true; onSpeakRef.current(msg.text);
      }
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      return;
    }
    
    let i = 0;
    setIsTypingText(true);
    setAnimatingIds?.((prev) => [...prev, msg.id]);
    setDisplayedText("");
    
    const timer = setInterval(() => {
      setDisplayedText(msg.text.slice(0, i + 1));
      i++;
      scrollRef.current?.scrollIntoView();
      if (i >= msg.text.length) {
        clearInterval(timer);
        setIsTypingText(false);
        setAnimatingIds?.((prev) => prev.filter((id) => id !== msg.id));
        
        if (!msg.spoken && !isMutedRef.current && onSpeakRef.current && !hasSpoken.current && agentMode === "text") {
          hasSpoken.current = true; onSpeakRef.current(msg.text);
        }
        setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    }, 15);
    
    return () => {
      clearInterval(timer);
      setAnimatingIds?.((prev) => prev.filter((id) => id !== msg.id));
    };
  }, [msg.id, agentMode, msg.text, msg.instant]);

  return (
    <div className="cdw-enter flex max-w-[85%] flex-col gap-2 self-start">
      <div className="relative whitespace-pre-wrap rounded-panel rounded-bl-chip bg-paper-2 px-3.5 py-2.5 leading-relaxed text-ink">
        {displayedText}
        {isTypingText && <span aria-hidden="true" className="cdw-caret ml-1 inline-block h-3.5 w-1.5 bg-signal align-middle" />}
        {!isTypingText && msg.isLastChunk !== false && (
          <button onClick={() => onSpeak(msg.fullText || msg.text)} className="cd-icon-btn -my-2.5 ml-0.5 align-middle" title="Read Aloud" aria-label="Read Aloud" type="button"><Volume2 aria-hidden="true" /></button>
        )}
      </div>
      {!isTypingText && msg.buttons?.length > 0 && (
        <div className="cdw-enter flex w-full flex-col gap-1.5">
          {msg.buttons.map((btn) => {
            const isCTA = btn.value === "path_book" || btn.value === "path_demo" || btn.value === "confirm_yes" || btn.value.startsWith("date_") || btn.value.startsWith("time_");
            return (
              <button
                key={btn.value} onClick={() => onButtonClick(btn.value, btn.label)} disabled={isProcessing} type="button"
                className={`cdw-focus min-h-9 rounded-control border bg-paper-3 px-3.5 py-2 text-left text-ink transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${isCTA ? "border-signal font-semibold hover:bg-signal-wash" : "border-rule font-medium hover:bg-hover"}`}
              >
                {btn.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default function AicyroChatbot({ tenantId: propTenantId } = {}) {
  const tenantId = propTenantId 
    || (typeof window !== "undefined" && (window.__CLOSEDESK_TENANT_ID__ || new URLSearchParams(window.location.search).get("tenant") || new URLSearchParams(window.location.search).get("tenant_id")))
    || "default";
  const [isOpen, setIsOpen] = useState(false);
  const [showPeek, setShowPeek] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  const isInIframe = typeof window !== "undefined" && window.self !== window.top;

  useEffect(() => {
    if (typeof window !== "undefined" && window.parent && window.parent !== window) {
      window.parent.postMessage(
        { 
          type: "CLOSEDESK_WIDGET_RESIZE", 
          isExpanded: isOpen,
          hasPeek: showPeek
        }, 
        "*"
      );
    }
  }, [isOpen, showPeek]);
  const [step, setStep] = useState(STEPS.WELCOME);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [animatingIds, setAnimatingIds] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [firebaseDbId] = useState(() => `lead_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
  const firebaseDbIdRef = useRef(firebaseDbId);
  const [agentMode, setAgentMode] = useState("text");

  const hasSentStartAlertRef = useRef(false);
  const hasSentBasicInfoAlertRef = useRef(false);
  const hasSentMeetingAlertRef = useRef(false);
  const hasSentUrgentCallbackAlertRef = useRef(false);
  const [voiceState, setVoiceState] = useState("IDLE");
  const voiceCallRef = useRef(null);
  const activeResponseRef = useRef(false);
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  // 🔥 Vision / WebRTC Camera States
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showWebcam, setShowWebcam] = useState(false);
  
  const fileGalleryInputRef = useRef(null);
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const imagePickerRef = useRef(null); // Ref for closing the picker when clicking outside
  
  const recognitionRef = useRef(null);
  const abortControllerRef = useRef(null);
  const baseInputRef = useRef("");
  const telemetryRef = useRef({ versions: null });
  const turnMetricsRef = useRef(null);

  useEffect(() => {
    if (voiceCallRef.current && voiceCallRef.current.audioEl) voiceCallRef.current.audioEl.muted = isMuted;
    if (isMuted) stopSpeech();
  }, [isMuted]);

  // --- Click Outside to Close Image Picker ---
  useEffect(() => {
    function handleClickOutside(event) {
      if (imagePickerRef.current && !imagePickerRef.current.contains(event.target)) {
        setShowImagePicker(false);
      }
    }
    if (showImagePicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showImagePicker]);

  // --- WebRTC Camera Setup for "Take a Photo" ---
  const openWebcam = async () => {
    if (!botConfig.photoUploads) return;
    setShowImagePicker(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      cameraStreamRef.current = stream;
      setShowWebcam(true);
    } catch (err) {
      uiLogger.error("camera", "permission_denied", { error: err });
      alert("Camera access denied or unavailable. Please check your browser permissions to take a photo.");
    }
  };

  const closeWebcam = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
    setShowWebcam(false);
  };

  useEffect(() => {
    if (showWebcam && videoRef.current && cameraStreamRef.current) {
      videoRef.current.srcObject = cameraStreamRef.current;
    }
  }, [showWebcam]);

  const capturePhotoFromWebcam = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const base64Data = canvas.toDataURL("image/jpeg", 0.75);

    closeWebcam();
    processBase64Image(base64Data);
  };
  // ---------------------------------------------

  // --- Shared Vision Processing Logic ---
  const processBase64Image = async (base64Jpeg) => {
    if (!botConfig.photoUploads) return;
    setIsUploadingImage(true);
    setIsProcessing(true);

    try {
      setMessages((prev) => [
        ...prev,
        {
          role: "user",
          text: "📷 Image Uploaded",
          imageUrl: base64Jpeg,
          id: Date.now(),
        }
      ]);

      const imagePath = `chat_images/${firebaseDbIdRef.current}/${Date.now()}.jpg`;
      const fileRef = storageRef(storage, imagePath);
      await uploadString(fileRef, base64Jpeg, "data_url");
      const downloadURL = await getDownloadURL(fileRef);

      const txId = generateCorrelationId();
      const response = await fetchWithTrace(
        "/api/analyze-image",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
          body: JSON.stringify({
            session_id: firebaseDbIdRef.current,
            image_url: downloadURL,
            user_prompt: "Identify the problem, severity, and recommend next steps."
          }),
        },
        txId
      );

      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Vision analysis failed");

      const visionData = result.data;

      // 🔥 ONLY update lead state if the image was actually relevant
      if (!visionData.is_irrelevant) {
        setLeadData((prev) => ({
          ...prev,
          business_problem: visionData.identified_issue || prev.business_problem,
          urgency_level: visionData.urgency_level || prev.urgency_level,
        }));
      }

      const shortcuts = (visionData.suggested_shortcuts || ["Book Inspection", "Request Callback"]).map((s) => ({
        label: s,
        value: `shortcut_${s}`
      }));

      addBotMessage(visionData.reply, shortcuts);

    } catch (err) {
      uiLogger.error("ai_vision", "client_upload_failed", { error: err });
      addBotMessage("Sorry, I had trouble processing that image. Please try uploading again or describe the issue in text.", []);
    } finally {
      setIsUploadingImage(false);
      setIsProcessing(false);
      if (fileGalleryInputRef.current) fileGalleryInputRef.current.value = "";
    }
  };

  const handleGallerySelected = async (e) => {
    if (!botConfig.photoUploads) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setShowImagePicker(false);
    const base64Jpeg = await compressImage(file);
    processBase64Image(base64Jpeg);
  };
  // ---------------------------------------------

  const resetTurnMetrics = () => {
    turnMetricsRef.current = { turn_id: Date.now().toString(), speech_start: null, speech_stop: null, response_created: null, stt_completed: null, first_audio: null, response_done: null, interrupted: false, tools: [] };
  };

  const flushTurnTelemetry = () => {
    if (!turnMetricsRef.current) return;
    const m = turnMetricsRef.current;
    if (m.response_created) {
      const txId = generateCorrelationId();
      const payload = {
        session_id: firebaseDbId, action: "log_telemetry",
        telemetry_data: {
          turn_id: m.turn_id, recording_duration: m.speech_stop && m.speech_start ? m.speech_stop - m.speech_start : null,
          stt_latency: m.stt_completed && m.speech_stop ? m.stt_completed - m.speech_stop : null, ai_latency: m.response_created && m.stt_completed ? m.response_created - m.stt_completed : null,
          first_audio_latency: m.first_audio && m.response_created ? m.first_audio - m.response_created : null, total_turn_latency: m.response_done && m.speech_start ? m.response_done - m.speech_start : null,
          interrupted: m.interrupted, tools: m.tools, versions: telemetryRef.current.versions,
        }
      };
      fetchWithTrace("/api/sync-voice", { method: "POST", headers: { "Content-Type": "application/json", "x-tenant-id": tenantId }, body: JSON.stringify(payload) }, txId)
        .catch((err) => voiceLogger.error("telemetry", "sync_failed", { error: err }));
    }
    turnMetricsRef.current = null;
  };

  const [botConfig, setBotConfig] = useState({
    botName: "Aicyro Front Desk", launcherText: "Need help?", greetingMessage: "Hi! I'm Aicyro's AI Assistant. How can I help you today?",
    botAvatar: "ai_spark", customAvatarSvg: "", botVoice: "Joanna", voiceEnabled: true,
    voiceChatAgent: true, photoUploads: true,
    enableDirectBooking: true, calendarActive: true,
  });

  const logVoiceError = (stage, message, rawError = null) => {
    const txId = generateCorrelationId();
    voiceLogger.error("webrtc", stage.toLowerCase(), { context: { error_message: message }, error: rawError, correlation: { correlation_id: txId } });
    fetchWithTrace("/api/sync-voice", { method: "POST", headers: { "Content-Type": "application/json", "x-tenant-id": tenantId }, body: JSON.stringify({ session_id: firebaseDbIdRef.current, action: "log_error", error_stage: stage, error_message: message, raw_error: rawError ? String(rawError) : null }) }, txId).catch(() => {});
  };

  useEffect(() => {
    return () => {
      if (voiceCallRef.current) {
        const { pc, stream, audioEl, dc } = voiceCallRef.current;
        if (dc) dc.close(); if (pc) pc.close();
        if (stream) stream.getTracks().forEach((track) => track.stop());
        if (audioEl) { audioEl.pause(); audioEl.srcObject = null; }
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false; recognition.interimResults = true; recognition.lang = "en-US";
        recognition.onresult = (event) => {
          let currentTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) currentTranscript += event.results[i][0].transcript;
          setInputValue(baseInputRef.current + currentTranscript);
        };
        recognition.onerror = (event) => { uiLogger.warn("speech_recognition", "recognition_error", { error: event.error }); setIsListening(false); };
        recognition.onend = () => setIsListening(false);
        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) { alert("Speech recognition is not supported in this browser."); return; }
    if (isListening) { recognitionRef.current.stop(); setIsListening(false); } 
    else {
      stopSpeech();
      try {
        const currentText = inputRef.current ? inputRef.current.value : inputValue;
        baseInputRef.current = currentText ? currentText.endsWith(" ") ? currentText : currentText + " " : "";
        recognitionRef.current.start(); setIsListening(true);
      } catch (err) { uiLogger.error("speech_recognition", "start_failed", { error: err }); }
    }
  };

  const handleInputInteraction = () => { if (isListening && recognitionRef.current) { recognitionRef.current.stop(); setIsListening(false); } };

  const handleStartVoiceCall = async () => {
    if (!hasTrackedConvo) {
      trackConversationStarted("Voice session initiated", tenantId);
      setHasTrackedConvo(true);
    }
    if (!botConfig.voiceChatAgent || !botConfig.voiceEnabled) return;
    const txId = generateCorrelationId();
    const callLogger = voiceLogger.child({ correlation: { correlation_id: txId } });

    callLogger.info("voice_lifecycle", "voice_session_requested", { context: { session_id: firebaseDbId }});

    setVoiceState("REQUESTING_PERMISSION");
    let localStream;

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("UNSUPPORTED_BROWSER");
      localStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      callLogger.info("voice_lifecycle", "mic_permission_granted");
    } catch (error) {
      setVoiceState("PERMISSION_DENIED");
      callLogger.error("voice_lifecycle", "mic_permission_denied", { error });
      logVoiceError("MIC_PERMISSION", "Microphone access denied or failed", error.message || error.name);
      return;
    }

    setVoiceState("PROCESSING");
    try {
      const tokenResponse = await fetchWithTrace("/api/openai-token", { method: "POST", headers: { "Content-Type": "application/json", "x-tenant-id": tenantId }, body: JSON.stringify({ session_id: firebaseDbId }) }, txId);
      const data = await tokenResponse.json();

      if (!tokenResponse.ok) {
        logVoiceError("TOKEN_FETCH", "Failed to fetch OpenAI token", data.error);
        throw new Error(data.error || "Failed to fetch session token.");
      }

      const EPHEMERAL_KEY = data.client_secret?.value || data.value;
      if (data.versions) telemetryRef.current.versions = data.versions;

      const pc = new RTCPeerConnection();
      const audioEl = new Audio();
      audioEl.autoplay = true; audioEl.muted = isMuted;
      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0];
        audioEl.play().catch((err) => { setIsMuted(true); callLogger.warn("audio", "playback_blocked", { error: err }); });
      };
      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

      const dataChannel = pc.createDataChannel("oai-events");
      dataChannel.onopen = () => {
        setVoiceState("LISTENING");
        callLogger.info("voice_lifecycle", "voice_session_started", { context: { session_id: firebaseDbId }});
        if (!hasSentStartAlertRef.current) {
          hasSentStartAlertRef.current = true;
          queueEmailAlert("New Voice Call Started", "A visitor has connected to the AI Voice Agent.", leadDataRef.current, "start");
        }
      };

      dataChannel.onclose = () => {
        setVoiceState((prev) => (prev === "ERROR" ? "ERROR" : "IDLE"));
        activeResponseRef.current = false;
        flushTurnTelemetry();
      };

      dataChannel.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          
          if (event.type === "response.created") {
            setVoiceState("PROCESSING"); activeResponseRef.current = true;
            callLogger.info("voice_lifecycle", "ai_processing_started");
            if (turnMetricsRef.current) turnMetricsRef.current.response_created = Date.now();
          } 
          else if (event.type === "response.done" || event.type === "response.cancelled" || event.type === "response.failed") {
            setVoiceState("LISTENING"); activeResponseRef.current = false;
            if (event.type === "response.done") callLogger.info("voice_lifecycle", "audio_response_completed");
            if (event.type === "response.cancelled") callLogger.warn("voice_lifecycle", "response_interrupted");
            if (turnMetricsRef.current) {
              turnMetricsRef.current.response_done = Date.now();
              if (event.type === "response.cancelled") turnMetricsRef.current.interrupted = true;
              flushTurnTelemetry();
            }
          } 
          else if (event.type === "error") {
            setVoiceState("ERROR"); activeResponseRef.current = false;
            flushTurnTelemetry();
            logVoiceError("REALTIME_API", "OpenAI Realtime API error", JSON.stringify(event.error));
          }

          if (event.type === "input_audio_buffer.speech_started") {
            setVoiceState((prev) => prev === "SPEAKING" ? "INTERRUPTED" : "LISTENING");
            if (activeResponseRef.current) callLogger.warn("voice_lifecycle", "barge_in", { context: { message: "User interrupted the AI" }});
            else callLogger.info("voice_lifecycle", "speech_started");
            if (turnMetricsRef.current && activeResponseRef.current) { turnMetricsRef.current.interrupted = true; flushTurnTelemetry(); }
            resetTurnMetrics(); turnMetricsRef.current.speech_start = Date.now();
          } 
          else if (event.type === "input_audio_buffer.speech_stopped") {
            setVoiceState("PROCESSING"); callLogger.info("voice_lifecycle", "speech_stopped");
            if (turnMetricsRef.current) turnMetricsRef.current.speech_stop = Date.now();
          } 
          else if (event.type === "response.audio.delta") {
            setVoiceState("SPEAKING");
            if (turnMetricsRef.current && !turnMetricsRef.current.first_audio) { turnMetricsRef.current.first_audio = Date.now(); callLogger.info("voice_lifecycle", "audio_response_started"); }
          }

          if (event.type === "conversation.item.input_audio_transcription.completed") {
            callLogger.info("voice_lifecycle", "transcription_completed");
            if (turnMetricsRef.current) turnMetricsRef.current.stt_completed = Date.now();
            const cleanTranscript = event.transcript ? event.transcript.replace(/[^\w\s]/gi, "").trim() : "";
            if (!cleanTranscript) {
              if (event.item_id) dataChannel.send(JSON.stringify({ type: "conversation.item.delete", item_id: event.item_id }));
              setVoiceState("LISTENING"); turnMetricsRef.current = null;
              return;
            }
            if (event.transcript.trim()) setMessages((prev) => [...prev, { role: "user", text: event.transcript, id: Date.now() + Math.random(), channel: "voice" }]);
          }

          if (event.type === "response.function_call_arguments.done") {
            const toolStart = Date.now();
            const toolTxId = generateCorrelationId();
            let parsedArgs;
            try {
              parsedArgs = JSON.parse(event.arguments);
            } catch (parseError) {
              uiLogger.error("ai_tool", "tool_call_failed", { error: parseError, context: { tool_name: event.name, tool_call_id: event.call_id, result_status: "invalid_parameters" }, metadata: { raw_args_snippet: String(event.arguments).substring(0, 50) + "..." } });
              dataChannel.send(JSON.stringify({ type: "conversation.item.create", item: { type: "function_call_output", call_id: event.call_id, output: JSON.stringify({ error: "Invalid JSON Schema" }) } }));
              dataChannel.send(JSON.stringify({ type: "response.create" }));
              return;
            }

            uiLogger.info("ai_tool", "tool_call_started", { context: { tool_name: event.name, tool_call_id: event.call_id }, metadata: { args: parsedArgs } });

            fetchWithTrace("/api/sync-voice", { method: "POST", headers: { "Content-Type": "application/json", "x-tenant-id": tenantId }, body: JSON.stringify({ session_id: firebaseDbId, tool_name: event.name, tool_args: parsedArgs }) }, toolTxId)
              .then((res) => res.json())
              .then((result) => {
                const duration_ms = Date.now() - toolStart;
                uiLogger.info("ai_tool", "tool_call_success", { context: { tool_name: event.name, tool_call_id: event.call_id, result_status: "success" }, duration_ms });
                if (turnMetricsRef.current) turnMetricsRef.current.tools.push({ name: event.name, duration_ms });
                dataChannel.send(JSON.stringify({ type: "conversation.item.create", item: { type: "function_call_output", call_id: event.call_id, output: JSON.stringify(result) } }));
                dataChannel.send(JSON.stringify({ type: "response.create" }));
              })
              .catch((err) => {
                const duration_ms = Date.now() - toolStart;
                uiLogger.error("ai_tool", "tool_call_failed", { error: err, context: { tool_name: event.name, tool_call_id: event.call_id, result_status: "failed" }, duration_ms });
                dataChannel.send(JSON.stringify({ type: "conversation.item.create", item: { type: "function_call_output", call_id: event.call_id, output: JSON.stringify({ success: false, error: "Backend error" }) } }));
                dataChannel.send(JSON.stringify({ type: "response.create" }));
              });
          }

          if (event.type === "response.audio_transcript.delta" || event.type === "response.output_audio_transcript.delta") {
            setMessages((prev) => {
              const lastMsg = prev[prev.length - 1];
              if (lastMsg && lastMsg.role === "bot" && lastMsg.isVoiceStream && lastMsg.itemId === event.item_id) {
                const updated = [...prev]; updated[updated.length - 1] = { ...lastMsg, text: lastMsg.text + event.delta }; return updated;
              } else {
                return [...prev, { role: "bot", text: event.delta, id: Date.now() + Math.random(), itemId: event.item_id, instant: true, spoken: true, isVoiceStream: true }];
              }
            });
          }
        } catch (err) { callLogger.error("webrtc", "data_channel_parse_error", { error: err }); }
      };

      const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
      const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", { method: "POST", body: offer.sdp, headers: { Authorization: `Bearer ${EPHEMERAL_KEY}`, "Content-Type": "application/sdp" } });

      if (!sdpResponse.ok) { logVoiceError("WEBRTC_NEGOTIATION", "Failed to negotiate WebRTC connection", await sdpResponse.text()); throw new Error("WebRTC negotiation failed"); }

      const answer = { type: "answer", sdp: await sdpResponse.text() };
      await pc.setRemoteDescription(answer);
      voiceCallRef.current = { pc, stream: localStream, audioEl, dc: dataChannel };
    } catch (error) {
      setVoiceState("ERROR"); activeResponseRef.current = false;
      if (localStream) localStream.getTracks().forEach((track) => track.stop());
    }
  };

  const handleEndVoiceCall = () => {
    try {
      if (voiceCallRef.current) {
        const { pc, stream, audioEl, dc } = voiceCallRef.current;
        if (dc) dc.close(); if (pc) pc.close();
        if (stream) stream.getTracks().forEach((track) => track.stop());
        if (audioEl) { audioEl.pause(); audioEl.srcObject = null; }
        voiceCallRef.current = null;
      }
      setVoiceState("IDLE"); activeResponseRef.current = false;
      voiceLogger.info("voice_lifecycle", "voice_session_ended", { context: { session_id: firebaseDbId }});
      logToFirebase("Call Ended", "Voice connection disconnected.", leadDataRef.current);
      submitLead({ ...leadDataRef.current, last_interaction_at: new Date().toISOString() });
    } catch (error) { voiceLogger.error("webrtc", "end_call_failed", { error }); setVoiceState("IDLE"); }
  };

  const handleToggleMode = async () => {
    const transitionEvent = agentMode === "text" ? "text_to_voice_switch" : "voice_to_text_switch";
    uiLogger.info("voice_lifecycle", transitionEvent, { context: { session_id: firebaseDbId }});

    stopSpeech();
    if (agentMode === "text") { if (!botConfig.voiceChatAgent || !botConfig.voiceEnabled) return; setAgentMode("voice"); } 
    else {
      if (voiceState !== "IDLE" && voiceState !== "ERROR") handleEndVoiceCall();
      setAgentMode("text");
      try {
        const snap = await get(ref(db, `prospects/${firebaseDbId}`));
        if (snap.exists()) {
          const pData = snap.val(); const cp = pData.context_patch || {}; const ci = cp.contact_info || {}; const bc = cp.business_context || {};
          setLeadData((prev) => ({
            ...prev, name: ci.name || prev.name, email: ci.email || prev.email, phone: ci.phone || prev.phone,
            website: bc.website || prev.website, business_type: bc.industry || prev.business_type,
            business_name: bc.industry || prev.business_name, service_requested: bc.interested_capability || prev.service_requested,
            conversation_summary: pData.factual_summary || prev.conversation_summary,
          }));
        }
      } catch (err) { uiLogger.error("state", "mode_switch_sync_failed", { error: err }); }
    }
  };

  const speakText = async (text) => {
    if (typeof window === "undefined" || isMuted || !text) return;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    if (window.currentAudio) { window.currentAudio.pause(); window.currentAudio.currentTime = 0; }

    try {
      const txId = generateCorrelationId();
      const cleanText = text.replace(/[^\w\s,.!?]/gi, "");
      const response = await fetchWithTrace("/api/tts", { method: "POST", headers: { "Content-Type": "application/json", "x-tenant-id": tenantId }, body: JSON.stringify({ text: cleanText, voiceId: botConfig.botVoice || "Joanna" }), signal: abortControllerRef.current.signal }, txId);

      if (!response.ok) throw new Error("TTS request failed");
      const blob = await response.blob();
      if (abortControllerRef.current.signal.aborted) return;

      const url = URL.createObjectURL(blob); const audio = new Audio(url); window.currentAudio = audio;
      audio.play().catch((err) => { uiLogger.warn("audio", "playback_blocked", { error: err }); setIsMuted(true); });
    } catch (error) { if (error.name !== "AbortError") uiLogger.error("tts", "polly_error", { error }); }
  };

  const stopSpeech = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (window.currentAudio) { window.currentAudio.pause(); window.currentAudio.currentTime = 0; window.currentAudio = null; }
  };

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const snapshot = await get(ref(db, "settings/chatbot_config"));
        if (snapshot.exists()) {
          const data = snapshot.val();
          const voiceState = data.voiceChatAgent !== undefined
            ? data.voiceChatAgent !== false
            : (data.voiceEnabled !== false);
          const photoState = data.photoUploads !== undefined
            ? data.photoUploads !== false
            : (data.photoUploadsEnabled !== undefined ? data.photoUploadsEnabled !== false : true);

          const calExists = Boolean(
            data.calendarActive !== false &&
            (data.calendarIntegration || data.calendarActive || data.integrations?.calendar || data.integrations?.GoogleCalendar || data.integrations?.Make || data.bookingRule)
          );
          const directBooking = (data.enableDirectBooking === false || data.enableDirectBooking === null)
            ? (calExists ? true : false)
            : (data.enableDirectBooking !== undefined ? data.enableDirectBooking : (calExists || true));
          const calActive = (data.calendarActive === false || data.calendarActive === null)
            ? (calExists ? true : false)
            : (data.calendarActive !== undefined ? data.calendarActive : true);

          setBotConfig({
            botName: data.botName || "Aicyro Front Desk", launcherText: data.launcherText || "Need help?",
            greetingMessage: data.greetingMessage || "Hi! I'm Aicyro's AI Assistant. How can I help you today?",
            botAvatar: data.botAvatar || "ai_spark", customAvatarSvg: data.customAvatarSvg || "",
            botVoice: data.botVoice || "Joanna", voiceEnabled: voiceState,
            voiceChatAgent: voiceState,
            photoUploads: photoState,
            enableDirectBooking: directBooking,
            calendarActive: calActive,
          });
          if (!voiceState) {
            setAgentMode("text");
          }
        }
      } catch (err) { uiLogger.error("config", "load_failed", { error: err }); }
    };
    fetchConfig();
  }, []);

  const [sessionStartTime] = useState(new Date().toISOString());
  const [hasTrackedOpen, setHasTrackedOpen] = useState(false);
  const [hasTrackedConvo, setHasTrackedConvo] = useState(false);
  const [avatarEffect, setAvatarEffect] = useState("");
  const [speechText, setSpeechText] = useState("");
  const [isHovered, setIsHovered] = useState(false);

  const [leadData, setLeadData] = useState({
    name: "", phone: "", email: "", business_name: "", business_type: "", business_problem: "",
    website: "", service_requested: "", location: "", visitor_intent: "", urgency_level: "",
    preferred_date: "", preferred_time: "", selected_date: "", conversation_summary: "",
    lead_score: "Low", booking_status: "In Progress", after_hours_flag: false, source_page: "",
  });

  const messagesEndRef = useRef(null); const inputRef = useRef(null);
  const leadDataRef = useRef(leadData); const messagesRef = useRef(messages);
  useEffect(() => { firebaseDbIdRef.current = firebaseDbId; }, [firebaseDbId]);
  const hasFiredUnload = useRef(false);
  useEffect(() => { leadDataRef.current = leadData; }, [leadData]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    const handleUnload = () => {
      if (hasFiredUnload.current) return;
      const currentLead = leadDataRef.current; const currentMessages = messagesRef.current;
      if (currentMessages.length > 1 && currentLead.booking_status !== "Meeting Booked") {
        hasFiredUnload.current = true;
        const currentTranscript = currentMessages.map((m) => `[${m.role.toUpperCase()}]: ${m.text || m.content || "Interaction"}`).join("\n");
        const payload = {
          source: "Website AI Front Desk", source_page: typeof window !== "undefined" ? window.location.href : "Unknown",
          anonId: getOrCreateAnonId() || "unknown", deviceName: getReadableDeviceName(), full_conversation_transcript: currentTranscript,
          conversation_started_at: sessionStartTime, last_interaction_at: new Date().toISOString(), conversation_ended_at: new Date().toISOString(),
          firebaseId: firebaseDbIdRef.current, ...currentLead, is_abandoned: true, booking_status: "Abandoned Mid-Conversation",
        };
        const sanitizedPayload = Object.fromEntries(Object.entries(payload).map(([k, v]) => [k, v === undefined || v === null ? "" : v]));
        fetchWithTrace("/api/leads", { method: "POST", headers: { "Content-Type": "application/json", "x-tenant-id": tenantId }, body: JSON.stringify(sanitizedPayload), keepalive: true }, generateCorrelationId()).catch(() => {});
      }
    };
    const handleVisibilityChange = () => { if (document.visibilityState === "hidden") handleUnload(); };
    window.addEventListener("beforeunload", handleUnload); document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => { window.removeEventListener("beforeunload", handleUnload); document.removeEventListener("visibilitychange", handleVisibilityChange); };
  }, [sessionStartTime]);

  const getActiveAvatarSrc = () => {
    if (botConfig.botAvatar === "custom") {
      if (botConfig.customAvatarSvg && botConfig.customAvatarSvg.trim().startsWith("<svg")) { return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(botConfig.customAvatarSvg)}`; }
      return `data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 20h9'%3E%3C/path%3E%3Cpath d='M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z'%3E%3C/path%3E%3C/svg%3E`;
    }
    return AVATAR_MAP[botConfig.botAvatar] || AVATAR_MAP.ai_spark;
  };
  const currentAvatarSrc = getActiveAvatarSrc();

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isTyping]);
  useEffect(() => { const timer = setTimeout(() => { if (!hasAutoOpened) { setShowPeek(true); setHasAutoOpened(true); } }, 6000); return () => clearTimeout(timer); }, [hasAutoOpened]);

  useEffect(() => {
    if (isOpen && messages.length === 0) { setStep(STEPS.AI_CHAT_MODE); addBotMessage(botConfig.greetingMessage, [], true); }
  }, [isOpen, messages.length, botConfig.greetingMessage]);

  useEffect(() => {
    if (isOpen && !isProcessing && [STEPS.AI_CHAT_MODE].includes(step) && agentMode === "text" && inputRef.current) { const timer = setTimeout(() => { inputRef.current?.focus(); }, 50); return () => clearTimeout(timer); }
  }, [isOpen, isProcessing, step, agentMode]);

  const handleAvatarHover = () => { setIsHovered(true); if (!avatarEffect) setSpeechText(["Beep boop! ⚡", "I capture leads 24/7!", "Let's maximize revenue!", "Need a fast demo? 👇"][Math.floor(Math.random() * 4)]); };
  const handleAvatarLeave = () => { setIsHovered(false); };
  const handleAvatarClick = (e) => { e.stopPropagation(); if (avatarEffect) return; setAvatarEffect("animate-avatar-flip"); setSpeechText("Whoa! 🚀"); setTimeout(() => { setAvatarEffect(""); if (isHovered) setSpeechText("Ready for action!"); }, 1000); };

// ==========================================
  // 🔥 HUMAN-LIKE MESSAGE CHUNKING SYSTEM
  // ==========================================
  async function addBotMessage(text, buttons = [], isInstant = false) {
    if (!text) return;
    
    // Strip out Markdown bolding asterisks just in case the AI sends them
    const cleanText = text.replace(/\*\*/g, "");
    
    // BULLETPROOF SPLIT: Split the text by the | delimiter OR by any newlines (\n)
    const chunks = cleanText.split(/[|\n]+/).map(t => t.trim()).filter(Boolean);
    const fullMessageText = chunks.join(" "); // Combine for the TTS reader
    
    // If it's an instant message (like loading history or a fallback error), dump them all at once
    if (isInstant) {
      setMessages((prev) => [
        ...prev,
        ...chunks.map((chunk, index) => ({
          role: "bot",
          text: chunk,
          fullText: fullMessageText,
          buttons: index === chunks.length - 1 ? buttons : [], // Only last chunk gets buttons
          instant: true,
          spoken: false,
          id: Date.now() + Math.random() + index,
          isLastChunk: index === chunks.length - 1 // Fixes speaker bug
        }))
      ]);
      return;
    }

    // Otherwise, simulate a human typing multiple separate bubbles
    setIsTyping(true);
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const isLast = i === chunks.length - 1;
      
      // Calculate dynamic delay before this bubble appears
      const prevTypingTime = i === 0 ? 0 : chunks[i - 1].length * 15;
      const humanPause = i === 0 ? 600 : 800; 
      const delay = prevTypingTime + humanPause;
      
      await new Promise((resolve) => setTimeout(resolve, delay));
      
      setMessages((prev) => [
        ...prev, 
        { 
          role: "bot", 
          text: chunk, 
          fullText: fullMessageText,
          buttons: isLast ? buttons : [], 
          instant: false, 
          spoken: false, 
          id: Date.now() + Math.random(),
          isLastChunk: isLast
        }
      ]);
      
      if (isLast) setIsTyping(false);
    }
  }
  // ==========================================

  
  function addUserMessage(text) {
    setMessages((prev) => {
      const cleanedMessages = prev.map((m) => m.role === "bot" && m.buttons?.length > 0 ? { ...m, buttons: m.buttons.filter((b) => !b.value.startsWith("shortcut_")) } : m);
      return [...cleanedMessages, { role: "user", text, id: Date.now() + Math.random() }];
    });
  }

  function openChat() {
    setShowPeek(false);
    setIsOpen(true);
    uiLogger.info("chatbot_ui", "widget_opened", {
      context: { message: "User manually opened chatbot UI" },
    });
    if (!hasTrackedOpen) {
      setHasTrackedOpen(true);
      trackChatOpened(tenantId);
    }
  }

  function handleCloseChat() { uiLogger.info("user_action", "widget_closed"); stopSpeech(); if (voiceState !== "IDLE" && voiceState !== "ERROR") handleEndVoiceCall(); submitLead({ ...leadDataRef.current, conversation_ended_at: new Date().toISOString() }); setMessages((prev) => prev.map((m) => ({ ...m, instant: true, spoken: true }))); setIsOpen(false); }

  function triggerConfirmation(finalData) {
    setStep(STEPS.CONFIRM_BOOKING);
    uiLogger.info("booking_lifecycle", "booking_requested", { context: { session_id: firebaseDbId, target_time: finalData.display_time }});
    addBotMessage(
      `Great! Before I lock this in, please confirm your details: | • Name: ${finalData.name || "N/A"}\n• Email: ${finalData.email || "N/A"}\n• Phone: ${finalData.phone || "N/A"}\n• Meeting: ${finalData.display_time} | Does everything look correct?`,
      [{ label: "Yes, Confirm Booking", value: "confirm_yes" }, { label: "No, Edit Details", value: "confirm_no" }],
    );
  }

  async function generateAndSendWebhook(data, timeText) {
    const txId = generateCorrelationId();
    const startTime = Date.now();
    
    uiLogger.info("ai_tool", "tool_call_started", { context: { tool_name: "create_booking_and_email", tool_call_id: txId }, metadata: { args: { data, timeText } }});
    uiLogger.info("booking_lifecycle", "booking_creation_started", { context: { session_id: firebaseDbId, target_time: timeText }});

    // Default Fallback Email Content (Used if the webhook fails)
    let emailSubject = "Your Demo is Confirmed!";
    let emailBody = `Hi ${data.name || "there"},\n\nYour meeting is confirmed for ${timeText}. We look forward to speaking with you!`;
    let bookingId = `bk_${txId.substring(0,8)}`;

    try {
      // Attempt to hit the Make.com webhook
      const response = await fetchWithTrace(
        "/api/generate-email",
        { method: "POST", headers: { "Content-Type": "application/json", "x-tenant-id": tenantId }, body: JSON.stringify({ name: data.name, business_type: data.business_type, time: timeText }) },
        txId,
      );
      
      if (response.ok) {
        const generatedEmail = await response.json();
        emailSubject = generatedEmail.subject || emailSubject;
        emailBody = generatedEmail.body || emailBody;
        bookingId = generatedEmail.messageId || bookingId;
      } else {
        uiLogger.warn("ai_tool", "email_generation_warning", { context: { message: `Webhook returned status ${response.status}. Using fallback email content.` }});
      }
    } catch (error) {
      uiLogger.warn("ai_tool", "email_generation_network_error", { context: { message: "Could not reach email generation API. Using fallback email content." }, error });
    }

    try {
      // 🔥 Proceed with the booking regardless of the email webhook's success
      uiLogger.info("ai_tool", "tool_call_success", { context: { tool_name: "create_booking_and_email", tool_call_id: txId, result_status: "success" }, duration_ms: Date.now() - startTime });
      uiLogger.info("booking_lifecycle", "booking_created", { context: { session_id: firebaseDbId, booking_id: bookingId, target_time: timeText }, duration_ms: Date.now() - startTime });

      if (!hasSentMeetingAlertRef.current) {
        hasSentMeetingAlertRef.current = true;
        queueEmailAlert("Meeting Booked! 📅", `${data.name || "A visitor"} confirmed a meeting for ${timeText}.`, data, "end", { visitorEmail: data.email, subject: emailSubject, body: emailBody });
      }

      submitLead({ ...data, booking_status: "Meeting Booked", requested_action: "Meeting Booked", generated_subject: emailSubject, generated_body: emailBody, conversation_ended_at: new Date().toISOString() });
      setIsProcessing(false);
      addBotMessage(`✅ Contact Confirmed! | Your demo is officially booked for ${timeText}. We have securely saved your details and sent a calendar invite to ${data.email || "your email"}.`, [{ label: "Close Chat", value: "close" }], true);
    
    } catch (dbError) {
      // Only throw a fatal Booking Error if the actual database submission fails
      uiLogger.error("booking_lifecycle", "booking_failed_fatal", { error: dbError, context: { session_id: firebaseDbId, target_time: timeText }});
      
      setIsProcessing(false);
      addBotMessage(`⚠️ Booking Error | Sorry, I couldn't secure that calendar slot due to a network error. Please try selecting a different time or contact us directly.`, [], true);
      setStep(STEPS.AI_CHAT_MODE); 
    }
  }

  async function submitLead(data) {
    const txId = generateCorrelationId();
    const startTime = Date.now();
    uiLogger.info("ai_tool", "tool_call_started", { context: { tool_name: "submit_lead", tool_call_id: txId }, metadata: { args: data } });

    try {
      const currentTranscript = messagesRef.current.map((m) => `[${m.role.toUpperCase()}]: ${m.text || m.content || "Interaction"}`).join("\n");
      const payload = {
        source: "Website AI Front Desk", source_page: typeof window !== "undefined" ? window.location.href : "Unknown",
        anonId: getOrCreateAnonId() || "unknown", deviceName: getReadableDeviceName(), full_conversation_transcript: currentTranscript,
        conversation_started_at: sessionStartTime, last_interaction_at: new Date().toISOString(), ...(!firebaseDbId && { timestamp: new Date().toISOString() }),
        firebaseId: firebaseDbId, ...data,
      };
      const sanitizedPayload = Object.fromEntries(Object.entries(payload).map(([k, v]) => [k, v === undefined || v === null ? "" : v]));

      const res = await fetchWithTrace("/api/leads", { method: "POST", headers: { "Content-Type": "application/json", "x-tenant-id": tenantId }, body: JSON.stringify(sanitizedPayload), keepalive: true }, txId);
      if (!res.ok) throw new Error(`Server status: ${res.status}`);
      
      uiLogger.info("ai_tool", "tool_call_success", { context: { tool_name: "submit_lead", tool_call_id: txId, result_status: "success" }, duration_ms: Date.now() - startTime });
    } catch (err) {
      uiLogger.error("ai_tool", "tool_call_failed", { error: err, context: { tool_name: "submit_lead", tool_call_id: txId, result_status: "failed" }, duration_ms: Date.now() - startTime });
      uiLogger.error("lead_capture", "submission_failed", { error: err, correlation: { correlation_id: txId } });
    }
  }

  async function processUserMessage(val) {
    if (isProcessing || !val.trim()) return;
    stopSpeech();
    if (isListening && recognitionRef.current) { recognitionRef.current.stop(); setIsListening(false); }

    addUserMessage(val);
    if (!hasTrackedConvo) { trackConversationStarted(val, tenantId); setHasTrackedConvo(true); uiLogger.info("user_action", "chat_started", { context: { message: "First message sent by user" } }); }

    if (!hasSentStartAlertRef.current) { hasSentStartAlertRef.current = true; queueEmailAlert("New Text Chat Started", `A visitor just started a chat: "${val}"`, leadData, "start"); }

    if (step === STEPS.AI_CHAT_MODE) {
      setIsProcessing(true);
      const txId = generateCorrelationId();
      uiLogger.info("chat", "user_message_received", { correlation: { correlation_id: txId } });

      const aiHistory = messagesRef.current.filter((m) => m.role === "user" || m.role === "bot").map((m) => ({ role: m.role === "bot" ? "assistant" : "user", content: m.text || "User interacted" }));
      aiHistory.push({ role: "user", content: val });

      try {
        const isBookingToolActive = Boolean(botConfig.enableDirectBooking !== false && botConfig.calendarActive !== false);
        const bookingToolDefinition = isBookingToolActive ? {
          type: "function",
          function: {
            name: "schedule_calendar_meeting",
            description: "Directly triggers the calendar booking tool when user asks to book a meeting and provides Name, Email, and Phone.",
            parameters: {
              type: "object",
              properties: {
                name: { type: "string" },
                email: { type: "string" },
                phone: { type: "string" },
                preferred_date: { type: "string" },
                preferred_time: { type: "string" }
              },
              required: ["name", "email", "phone"]
            }
          }
        } : null;

        const response = await fetchWithTrace("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
          body: JSON.stringify({
            session_id: firebaseDbId,
            current_lead_data: {
              ...leadData,
              enableDirectBooking: botConfig.enableDirectBooking,
              calendarActive: botConfig.calendarActive,
            },
            messages: aiHistory,
            enableDirectBooking: botConfig.enableDirectBooking,
            calendarActive: botConfig.calendarActive,
            booking_tool_active: isBookingToolActive,
            tools: bookingToolDefinition ? [bookingToolDefinition] : [],
          })
        }, txId);

        if (!response.ok) throw new Error(`API returned status ${response.status}`);
        const data = await response.json();

        const dynamicButtons = (data.suggested_shortcuts || []).map((shortcut) => ({ label: shortcut, value: `shortcut_${shortcut}` }));
        addBotMessage(data.reply, dynamicButtons);

        const contextPatch = data.context_patch || {}; const contactInfo = contextPatch.contact_info || {}; const businessContext = contextPatch.business_context || {}; const bookingReq = contextPatch.booking_request || {}; const extracted = data.extracted_data || {};

        const preferredDate = bookingReq.preferred_date || leadData.preferred_date; const preferredTime = bookingReq.preferred_time || leadData.preferred_time;
        let currentBookingStatus = leadData.booking_status || "In Progress"; let requestedAction = leadData.requested_action || "In Progress";

        const explicitBookingIntent = /\b(book|schedule|appointment|meeting|demo|calendar|consultation)\b/i.test(val);
        const hasContactInfoForBooking = Boolean((contactInfo.name || leadData.name) && (contactInfo.email || leadData.email) && (contactInfo.phone || leadData.phone));
        const shouldTriggerDirectBooking = (data.next_action === "SCHEDULE_CONSULTATION" || data.ready_to_book === true || extracted.ready_to_book === true) ||
          (isBookingToolActive && explicitBookingIntent && hasContactInfoForBooking);

        const isCallbackTrigger = !shouldTriggerDirectBooking && (data.next_action === "REQUEST_CALLBACK" || data.flags?.includes("TRIGGER_CALLBACK"));
        if (isCallbackTrigger) { currentBookingStatus = "Callback Requested"; requestedAction = "Callback Requested"; }

        const updatedLeadData = {
          ...leadData, name: contactInfo.name || extracted.name || leadData.name, email: contactInfo.email || extracted.email || leadData.email,
          phone: contactInfo.phone || extracted.phone || leadData.phone, website: businessContext.website || extracted.website || leadData.website,
          business_name: businessContext.industry || extracted.business_name || leadData.business_name, business_type: businessContext.industry || extracted.business_type || leadData.business_type,
          business_problem: businessContext.business_problem || leadData.business_problem, service_requested: businessContext.interested_capability || extracted.service_requested || leadData.service_requested,
          location: extracted.location || leadData.location, visitor_intent: (data.intent_object && data.intent_object.join(", ")) || data.visitor_intent || leadData.visitor_intent || "Unknown",
          urgency_level: data.urgency_level || leadData.urgency_level || "Unknown", preferred_date: preferredDate, preferred_time: preferredTime, booking_status: currentBookingStatus, requested_action: requestedAction,
          conversation_summary: data.factual_summary || data.conversation_summary || leadData.conversation_summary || "In progress...", lead_score: data.lead_temperature || data.lead_score || leadData.lead_score || "Low",
          after_hours_flag: data.after_hours_flag !== undefined ? data.after_hours_flag : leadData.after_hours_flag,
        };

        setLeadData(updatedLeadData);

        const textMentionsUrgent = /\burgent\b/i.test(val);
        const markedHighUrgency = data.urgency_level?.toLowerCase() === "high" || updatedLeadData.urgency_level?.toLowerCase() === "high";

        if (isCallbackTrigger && (textMentionsUrgent || markedHighUrgency) && !hasSentUrgentCallbackAlertRef.current) {
          hasSentUrgentCallbackAlertRef.current = true;
          const timeNotice = preferredTime ? `for ${preferredTime}${preferredDate ? ` on ${preferredDate}` : ""}` : "as soon as possible";
          queueEmailAlert("URGENT Callback Requested! 🚨", `${contactInfo.name || updatedLeadData.name || "A visitor"} requested an urgent callback ${timeNotice}. Phone: ${contactInfo.phone || updatedLeadData.phone || "Not provided"}`, updatedLeadData, "end");
        }

        const hasAllBasicInfo = Boolean(updatedLeadData.name && updatedLeadData.email && updatedLeadData.phone);
        if (hasAllBasicInfo && !hasSentBasicInfoAlertRef.current) {
          hasSentBasicInfoAlertRef.current = true;
          queueEmailAlert("Lead Contact Info Captured 🎯", `${updatedLeadData.name} has provided their name, email, and phone number.`, updatedLeadData, "end");
        }

        if (updatedLeadData.name || updatedLeadData.email || updatedLeadData.phone || updatedLeadData.business_name || updatedLeadData.service_requested) {
          submitLead({ ...updatedLeadData, booking_status: isCallbackTrigger ? "Callback Requested" : (shouldTriggerDirectBooking ? "In Progress - Booking Calendar" : "Lead Captured - Unbooked"), requested_action: isCallbackTrigger ? "Callback Requested" : (shouldTriggerDirectBooking ? "Scheduling Meeting" : "Lead Captured - Unbooked") });
        }

        if ((shouldTriggerDirectBooking || data.next_action === "SCHEDULE_CONSULTATION" || data.ready_to_book === true || extracted.ready_to_book === true) && updatedLeadData.name && updatedLeadData.email) {
          setTimeout(() => {
            if (updatedLeadData.preferred_date && updatedLeadData.preferred_time) {
              const exactTimeText = `${updatedLeadData.preferred_date} at ${updatedLeadData.preferred_time}`;
              const finalLeadData = { ...updatedLeadData, display_time: exactTimeText };
              setLeadData(finalLeadData); triggerConfirmation(finalLeadData);
            } else if (updatedLeadData.preferred_date && !updatedLeadData.preferred_time) {
              setLeadData({ ...updatedLeadData, selected_date: updatedLeadData.preferred_date }); setStep(STEPS.SELECT_TIME);
              addBotMessage(`Great, ${updatedLeadData.preferred_date}. | What time works for you?`, generateTimeSlots().map((t) => ({ label: t, value: `time_${t}` })));
            } else {
              setStep(STEPS.SELECT_DATE); addBotMessage("Please select a date for your meeting:", getNextWeekdays().map((d) => ({ label: d, value: `date_${d}` })));
            }
          }, 1000);
        }
      } catch (error) {
        uiLogger.error("chat", "api_failed", { error, correlation: { correlation_id: txId } });
        addBotMessage("Network error trying to reach AI. Please try again.", []);
      } finally { setIsProcessing(false); }
    }
  }

  async function handleButtonClick(value, label) {
    if (isProcessing) return; stopSpeech();
    uiLogger.info("user_action", "chatbot_button_clicked", { context: { message: `Clicked: ${label}` } });
    
    if (value.startsWith("shortcut_")) { handleTextInput({ preventDefault: () => {} }, label); return; }

    if (!hasTrackedConvo) {
      trackConversationStarted(label, tenantId);
      setHasTrackedConvo(true);
      uiLogger.info("user_action", "chat_started", { context: { message: "First message sent by user via button" } });
    }

    addUserMessage(label);
    switch (step) {
      case STEPS.CHOOSE_PATH:
        if (value === "path_book") { uiLogger.info("lead_capture", "consultation_requested"); setStep(STEPS.SELECT_DATE); addBotMessage("Please select a date for your meeting:", getNextWeekdays().map((d) => ({ label: d, value: `date_${d}` }))); } 
        else if (value === "path_demo") { uiLogger.info("lead_capture", "demo_requested"); showMiniDemo(leadData.business_type || "Other"); }
        break;
      case STEPS.SELECT_DATE:
        if (value.startsWith("date_")) {
          const chosenDate = value.replace("date_", ""); setLeadData((d) => ({ ...d, selected_date: chosenDate })); setStep(STEPS.SELECT_TIME);
          addBotMessage(`Great, ${chosenDate}. | What time works for you?`, generateTimeSlots().map((t) => ({ label: t, value: `time_${t}` })));
        }
        break;
      case STEPS.SELECT_TIME:
        if (value.startsWith("time_")) {
          const chosenTime = value.replace("time_", ""); const exactTimeText = `${leadData.selected_date} at ${chosenTime}`; let isoDateSlot = exactTimeText;
          try { const parsedDate = new Date(`${leadData.selected_date} ${chosenTime}`); if (!isNaN(parsedDate)) isoDateSlot = parsedDate.toISOString(); } catch (e) {}
          const finalLeadData = { ...leadData, booked_slot: isoDateSlot, display_time: exactTimeText };
          setLeadData(finalLeadData); triggerConfirmation(finalLeadData);
        }
        break;
      case STEPS.CONFIRM_BOOKING:
        if (value === "confirm_yes") { setStep(STEPS.FINAL_CTA); setIsProcessing(true); generateAndSendWebhook({ ...leadData, requested_action: "Meeting Booked" }, leadData.display_time); } 
        else if (value === "confirm_no") { setStep(STEPS.AI_CHAT_MODE); addBotMessage("No problem. | Just tell me what needs to be changed (e.g., 'Change my email to xyz@test.com')."); }
        break;
      case STEPS.FINAL_CTA:
        if (value === "close") handleCloseChat(); break;
      default: break;
    }
  }

  function showMiniDemo(businessType) {
    const demo = INDUSTRY_DEMOS[businessType] || INDUSTRY_DEMOS["Other"];
    addBotMessage(`Here's how it works! | Imagine a visitor comes to your site and says: '${demo.scenario}' | Aicyro checks urgency, captures their info instantly, and pushes them to call or book 24/7.`, []);
    setTimeout(() => {
      setMessages((prev) => [...prev, { role: "bot", type: "demo_card", demo, id: Date.now() + Math.random(), instant: true, spoken: true }]);
      setTimeout(() => {
        setStep(STEPS.SELECT_DATE); addBotMessage("Pretty cool, right? | Let's get a free demo booked so you can see it in action on your own site. | What day works best?", getNextWeekdays().map((d) => ({ label: d, value: `date_${d}` })));
      }, 1500);
    }, 1500);
  }

  async function handleTextInput(e, shortcutValue = null) {
    if (e?.preventDefault) e.preventDefault(); const val = shortcutValue || inputValue.trim(); if (!val) return;
    uiLogger.info("user_action", "message_submitted", { context: { message: "Text input submitted" } });
    setInputValue("");
    
    if (agentMode === "voice" && voiceCallRef.current?.dc && voiceCallRef.current.dc.readyState === "open") {
      setVoiceState("PROCESSING"); addUserMessage(val);
      voiceCallRef.current.dc.send(JSON.stringify({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text: val }] } }));
      voiceCallRef.current.dc.send(JSON.stringify({ type: "response.create" }));
      return;
    }
    processUserMessage(val);
  }

  return (
    <div className={`cdw fixed ${isInIframe ? "bottom-2 right-2" : "bottom-4 right-4 sm:bottom-6 sm:right-6"} z-[99999] flex flex-col items-end gap-3 font-body text-ink`}>
      {showPeek && !isOpen && (
        <div className="cdw-teaser cdw-lift w-[288px] max-w-[calc(100vw-2rem)] rounded-panel border border-rule bg-paper-3 p-4">
          <div className="flex items-start gap-3">
            <div onClick={openChat} onMouseEnter={handleAvatarHover} onMouseLeave={handleAvatarLeave} className={`size-10 shrink-0 cursor-pointer overflow-hidden rounded-full bg-paper-2 ${avatarEffect}`}>
              <img src={currentAvatarSrc} alt="AI Avatar" className="h-full w-full object-contain p-1.5" />
            </div>
            <p className="pt-0.5 font-medium leading-snug text-ink">
              Want to see how many website leads you might be missing?
            </p>
          </div>
          <div className="mt-3 flex gap-2 pl-[52px]">
            <button type="button" className="cd-btn" onClick={openChat}>Show me</button>
            <button type="button" className="cd-btn cd-btn--ghost" onClick={() => setShowPeek(false)}>Not now</button>
          </div>
        </div>
      )}

      {!isOpen && (
        <button type="button" className="cdw-focus cdw-lift inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-signal px-5 text-signal-ink transition-colors hover:bg-[var(--color-accent-hover)]" onClick={openChat} aria-label="Open Chat">
          <svg aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          <span className="text-[length:var(--text-md)] font-semibold">{botConfig.launcherText}</span>
        </button>
      )}

      {isOpen && (
        <div className={`fixed inset-0 ${isInIframe ? "sm:inset-auto sm:absolute sm:bottom-0 sm:right-0" : "sm:inset-auto sm:absolute sm:bottom-4 sm:right-0"} z-50 flex w-full flex-col sm:w-[380px]`}>
          <div role="dialog" aria-label={botConfig.botName} className="cdw-panel relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden border-rule bg-paper-3 sm:h-[620px] sm:max-h-[85vh] sm:rounded-panel sm:border">
            <div className="z-20 flex shrink-0 items-center gap-3 border-b border-rule bg-paper-3 px-4 pb-3 pt-[max(env(safe-area-inset-top),12px)] sm:pt-3">
              <div onMouseEnter={handleAvatarHover} onMouseLeave={handleAvatarLeave} onClick={handleAvatarClick} className={`relative size-9 shrink-0 cursor-pointer rounded-control bg-paper-2 ${avatarEffect}`}>
                <img src={currentAvatarSrc} alt="AI Assistant" className="h-full w-full object-contain p-1" />
                {isHovered && speechText && (
                  <div className="cdw-enter absolute left-0 top-full z-30 mt-2 whitespace-nowrap rounded-control bg-ink px-2.5 py-1.5 text-[length:var(--text-xs)] font-medium text-paper">
                    {speechText}
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <h3 className="truncate font-semibold leading-tight text-ink">{botConfig.botName}</h3>
                <span className="mt-0.5 truncate text-[length:var(--text-xs)] text-ink-2">Security & Lead Intel</span>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button type="button" onClick={() => { if (!isMuted) stopSpeech(); setIsMuted(!isMuted); }} className="cd-icon-btn" title={isMuted ? "Unmute Bot Voice" : "Mute Bot Voice"} aria-label={isMuted ? "Unmute Bot Voice" : "Mute Bot Voice"}>
                  {isMuted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
                </button>
                {(botConfig.voiceChatAgent && botConfig.voiceEnabled) && (
                  <button type="button" onClick={handleToggleMode} className="cd-icon-btn" title={agentMode === "text" ? "Switch to Call" : "Switch to Text"} aria-label={agentMode === "text" ? "Switch to Call" : "Switch to Text"}>
                    {agentMode === "text" ? <Phone aria-hidden="true" /> : <MessageSquareMore aria-hidden="true" />}
                  </button>
                )}
                <button type="button" onClick={handleCloseChat} className="cd-icon-btn" aria-label="Close chat">
                  <X aria-hidden="true" />
                </button>
              </div>
            </div>

            {voiceState === "PERMISSION_DENIED" && (botConfig.voiceChatAgent && botConfig.voiceEnabled) && (
              <div role="alert" className="z-20 flex shrink-0 items-center justify-between gap-3 border-b border-rule bg-[var(--color-danger-wash)] px-4 py-2 text-[length:var(--text-xs)]">
                <span className="font-semibold text-danger">Microphone access denied.</span>
                <button type="button" onClick={handleStartVoiceCall} className="cd-btn cd-btn--quiet">Request Again</button>
              </div>
            )}

            {/* WebRTC camera overlay */}
            {botConfig.photoUploads && showWebcam && (
              <div className="cdw-enter absolute inset-0 z-50 flex flex-col items-center justify-center bg-paper-2">
                <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />

                <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-6 px-6 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-4">
                  <button type="button" onClick={closeWebcam} className="cd-btn cd-btn--quiet">
                    Cancel
                  </button>
                  <button type="button" onClick={capturePhotoFromWebcam} aria-label="Take a Photo" className="cdw-focus size-16 rounded-full border-4 border-signal bg-paper-3 transition-transform active:scale-95">
                  </button>
                </div>
              </div>
            )}

            <div className="acy-scroll relative flex-1 overflow-y-auto overscroll-contain">
              {agentMode === "text" || (!botConfig.voiceChatAgent || !botConfig.voiceEnabled) ? (
                <div className="flex min-h-full flex-col gap-3 bg-paper-3 px-4 py-4">
                  {messages.map((msg) => {
                    if (msg.type === "demo_card") {
                      return (
                        <div key={msg.id} className="cdw-enter relative w-[85%] self-start rounded-panel bg-paper-2 p-4">
                          <div className="mb-3 flex items-center gap-2 border-b border-rule pb-3">
                            <Check className="size-4 text-success" aria-hidden="true" />
                            <span className="text-[length:var(--text-xs)] font-semibold text-ink">Intel captured</span>
                          </div>
                          <dl className="space-y-2">
                            {[["Intent", msg.demo.service], ["Name", "Alex M."], ["Phone", "(555) 019-2834"]].map(([k, v]) => (
                              <div key={k} className="flex items-center justify-between gap-3 text-[length:var(--text-xs)]">
                                <dt className="text-ink-2">{k}</dt><dd className="font-semibold tabular-nums text-ink">{v}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      );
                    }
                    if (msg.role === "bot") {
                      return <TypewriterBubble key={msg.id} msg={msg} onButtonClick={handleButtonClick} scrollRef={messagesEndRef} isProcessing={isProcessing} onSpeak={speakText} isMuted={isMuted} agentMode={agentMode} setAnimatingIds={setAnimatingIds} />;
                    }
                    return (
                      <div key={msg.id} className="cdw-enter flex max-w-[85%] flex-col gap-1.5 self-end">
                        <div className="whitespace-pre-wrap rounded-panel rounded-br-chip bg-signal px-3.5 py-2.5 leading-relaxed text-signal-ink">
                          {msg.imageUrl && (
                            <img
                              src={msg.imageUrl}
                              alt="Uploaded problem"
                              className="mb-2 max-h-48 w-full rounded-control object-cover"
                            />
                          )}
                          {msg.text}
                        </div>
                      </div>
                    );
                  })}
                  {isTyping && (
                    <div className="cdw-enter flex items-center gap-1.5 self-start rounded-panel rounded-bl-chip bg-paper-2 px-4 py-3.5">
                      <span aria-hidden="true" className="cdw-dot size-1.5 rounded-full bg-ink-2"></span>
                      <span aria-hidden="true" className="cdw-dot size-1.5 rounded-full bg-ink-2"></span>
                      <span aria-hidden="true" className="cdw-dot size-1.5 rounded-full bg-ink-2"></span>
                    </div>
                  )}
                  <div ref={messagesEndRef} className="h-2 shrink-0" />
                </div>
              ) : (
                <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-paper-3 p-6 pb-[calc(env(safe-area-inset-bottom,0px)+24px)]">
                  <div className="relative mb-8 flex size-28 items-center justify-center rounded-full bg-paper-2" aria-hidden="true">
                    <img src={currentAvatarSrc} alt="Voice Agent" className="relative z-10 size-20 object-contain" />
                    {voiceState === "LISTENING" && <div className="cdw-ring--pulse absolute inset-0 rounded-full border-2 border-success"></div>}
                    {voiceState === "PROCESSING" && <div className="cdw-ring--spin absolute -inset-2 rounded-full border-2 border-dashed border-signal"></div>}
                    {voiceState === "SPEAKING" && (<><div className="cdw-ring--pulse absolute -inset-2 rounded-full border-2 border-signal"></div><div className="cdw-ring--pulse cdw-ring--late absolute -inset-4 rounded-full border border-signal"></div></>)}
                    {voiceState === "INTERRUPTED" && <div className="absolute inset-0 rounded-full border-2 border-warn"></div>}
                    {voiceState === "ERROR" && <div className="absolute inset-0 rounded-full border-2 border-danger"></div>}
                  </div>
                  <h3 className="mb-2 text-center text-[length:var(--text-lg)] font-semibold text-ink" aria-live="polite">
                    {voiceState === "IDLE" && "Ready to speak?"}
                    {voiceState === "REQUESTING_PERMISSION" && "Allow Microphone..."}
                    {voiceState === "PERMISSION_DENIED" && "Microphone Denied"}
                    {voiceState === "LISTENING" && "Listening..."}
                    {voiceState === "PROCESSING" && "Thinking..."}
                    {voiceState === "SPEAKING" && "Agent Speaking..."}
                    {voiceState === "INTERRUPTED" && "Listening..."}
                    {voiceState === "ERROR" && "Connection Lost"}
                  </h3>
                  <p className="mb-8 max-w-[260px] text-center text-[length:var(--text-xs)] text-ink-2">
                    {voiceState === "IDLE" ? "Tap below to start a live voice conversation with our Close Desk." : voiceState === "PERMISSION_DENIED" ? "Microphone access is required to use voice. Please check your browser settings or continue using text below." : voiceState === "ERROR" ? "The secure backend connection was dropped. Please try again or continue using text below." : "Speak naturally. You can also use the text box below anytime."}
                  </p>
                  {voiceState === "ERROR" && (
                    <button type="button" onClick={handleStartVoiceCall} className="cd-btn">
                      <RefreshCw aria-hidden="true" />
                      Reconnect
                    </button>
                  )}
                  {(voiceState === "IDLE" || voiceState === "PERMISSION_DENIED") && (
                    <button type="button" onClick={handleStartVoiceCall} className="cd-btn">
                      <Phone aria-hidden="true" />
                      Start Voice Call
                    </button>
                  )}
                  {["LISTENING", "PROCESSING", "SPEAKING", "INTERRUPTED", "REQUESTING_PERMISSION"].includes(voiceState) && (
                    <button type="button" onClick={handleEndVoiceCall} className="cd-btn cd-btn--danger">
                      <PhoneOff aria-hidden="true" />
                      End Call
                    </button>
                  )}
                  <div className="mt-auto flex w-full items-center justify-center pt-6">
                    <span className="text-[length:var(--text-2xs)] text-ink-2">Powered by Aicyro</span>
                  </div>
                </div>
              )}
            </div>

            <div className="z-20 shrink-0 border-t border-rule bg-paper-3 p-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] sm:pb-3">
              {[STEPS.AI_CHAT_MODE].includes(step) ? (
                <>
                  {botConfig.photoUploads && (
                    <input type="file" ref={fileGalleryInputRef} accept="image/*" className="hidden" onChange={handleGallerySelected} />
                  )}

                  <form className="relative flex items-center gap-1" onSubmit={handleTextInput}>

                    {/* The camera button and its menu sit inside imagePickerRef so a click outside closes the menu */}
                    {botConfig.photoUploads && (
                      <div ref={imagePickerRef} className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() => setShowImagePicker(!showImagePicker)}
                          disabled={isUploadingImage || isProcessing}
                          className="cd-icon-btn"
                          title="Send Photo of the Issue"
                          aria-label="Send Photo of the Issue"
                          aria-expanded={showImagePicker}
                        >
                          <Camera aria-hidden="true" />
                        </button>

                        {showImagePicker && (
                          <div className="cd-popover cdw-enter bottom-full left-0 mb-2 flex min-w-[208px] flex-col gap-0.5 p-1">
                            <div
                              onClick={(e) => { e.stopPropagation(); openWebcam(); }}
                              className="cdw-menu-item flex min-h-9 w-full cursor-pointer items-center gap-2.5 rounded-control px-3 text-left font-medium text-ink transition-colors hover:bg-hover"
                            >
                              <Camera className="size-4 text-ink-2" aria-hidden="true" /> Take a Photo
                            </div>
                            <div
                              onClick={(e) => { e.stopPropagation(); setShowImagePicker(false); fileGalleryInputRef.current?.click(); }}
                              className="cdw-menu-item flex min-h-9 w-full cursor-pointer items-center gap-2.5 rounded-control px-3 text-left font-medium text-ink transition-colors hover:bg-hover"
                            >
                              <ImageIcon className="size-4 text-ink-2" aria-hidden="true" /> Upload from Gallery
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <button type="button" onClick={toggleListening} className={`cd-icon-btn shrink-0 ${isListening ? "bg-[var(--color-danger-wash)] text-danger hover:bg-[var(--color-danger-wash)] hover:text-danger" : ""}`} title={isListening ? "Stop listening" : "Speak to type"} aria-label={isListening ? "Stop listening" : "Speak to type"}>
                      <Mic aria-hidden="true" />
                    </button>

                    <input
                      ref={inputRef}
                      disabled={agentMode === "text" && isUploadingImage}
                      onClick={handleInputInteraction}
                      onFocus={handleInputInteraction}
                      className="cd-input mx-1 min-w-0 flex-1"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder={isUploadingImage ? "Uploading & diagnosing..." : isListening ? "Listening..." : "Type, snap photo, or speak..."}
                    />

                    <button
                      type="submit"
                      disabled={!inputValue.trim() || (agentMode === "text" && (isProcessing || isTyping || animatingIds.length > 0))}
                      className="cd-icon-btn shrink-0 bg-signal text-signal-ink hover:bg-[var(--color-accent-hover)] hover:text-signal-ink disabled:hover:bg-signal"
                      aria-label="Send"
                    >
                      <ArrowRight aria-hidden="true" />
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex w-full items-center justify-center gap-1.5 py-2">
                  <svg aria-hidden="true" className="size-3.5 text-ink-2" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2zm0 4.5l6.5 13.5h-13L12 6.5z" /></svg>
                  <span className="text-[length:var(--text-2xs)] text-ink-2">Powered by Aicyro</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
