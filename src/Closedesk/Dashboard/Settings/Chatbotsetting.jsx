// src/Closedesk/Dashboard/Settings/Chatbotsetting.jsx
"use client";

import { useState, useEffect } from "react";
import { CircleAlert, CircleCheck, Plus, Volume2, X } from "lucide-react";
import { db } from "../../../lib/firebase";
import { ref, set, get } from "firebase/database";

// 🔥 TICKET 14
import { createPulseLogger } from "../../../lib/loggerPresets";
import { recordAuditTrail } from "../../../lib/auditTracer";
const pulseLogger = createPulseLogger("ChatbotSettings");

const AVATAR_OPTIONS = [
  { id: "ai_spark", label: "AI Spark", src: "/avatars/ai-spark.svg" },
  { id: "bot_classic", label: "Classic Bot", src: "/avatars/bot-classic.svg" },
  { id: "human_agent", label: "Human Agent", src: "/avatars/human-agent.svg" },
  { id: "minimal_dot", label: "Minimalist", src: "/avatars/minimal-dot.svg" },
  { id: "custom", label: "Custom SVG", isCustom: true },
];

const InfoTooltip = ({ text }) => (
  <span className="group relative ml-1.5 inline-flex cursor-help items-center align-text-bottom">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-[var(--color-muted)] transition-colors group-hover:text-ink"
    >
      <circle cx="12" cy="12" r="10"></circle>
      <path d="M12 16v-4"></path>
      <path d="M12 8h.01"></path>
    </svg>
    <span className="cd-popover pointer-events-none bottom-full left-1/2 mb-2 hidden w-56 -translate-x-1/2 px-3 py-2 text-left text-[length:var(--text-2xs)] font-normal leading-relaxed text-ink group-hover:block">
      {text}
    </span>
  </span>
);

export default function ChatbotSettings({ onNavigate }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPlayingTest, setIsPlayingTest] = useState(false);
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
  });

  const [config, setConfig] = useState({
    serviceCategory: "General", // <-- NEW: Added Service Category for dynamic flows
    botAvatar: "ai_spark",
    customAvatarSvg: "",
    botName: "Aicyro Front Desk",
    launcherText: "Chat with us",
    themeColor: "#10b981",
    greetingMessage: "Hi! I'm Aicyro's AI Assistant. How can I help you today?",
    botIdentity: "the 'AI Front Desk' for Aicyro",
    companyContext:
      "We provide automated AI business systems and digital products.",
    customRules:
      "Speak naturally. Use conversational filler words occasionally like 'Got it', 'I understand', or 'Sure thing!'. Keep it empathetic.",
    additionalConversationalRules:
      "1. Acknowledge user input before asking the next question.\n2. Keep responses brief but warm.",
    tone: "Warm, Conversational & Human-like",
    botVoice: "ash",
    basePrompt:
      "Act as a friendly, human-like concierge. Build rapport and naturally weave your questions into a conversational flow. Avoid sounding like a strict robotic form.",
    leadCaptureFields: ["Name", "Email", "Phone"],
    businessIntelligenceFields: [
      "Industry Type",
      "Primary Business Problem",
      "Current CRM/Software",
      "Meeting Preference",
      "Location",
      "Website",
    ],
    services: [""],
    faqs: [{ question: "", answer: "" }],
    qualificationQuestions: [""],
    escalationRule: "email_admin",
    bookingRule: "require_all",
    enableDirectBooking: true,
    calendarActive: true,
    unavailableBehavior: "collect_lead",
    aiModel: "gpt-4o-mini",
    temperature: 0.4, 
    strictValidation: false,
    voiceChatAgent: true,
    photoUploads: true,
    voiceEnabled: true,
  });

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(
      () => setToast({ show: false, message: "", type: "success" }),
      3500,
    );
  };

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const snapshot = await get(ref(db, "settings/chatbot_config"));
        if (snapshot.exists()) {
          const data = snapshot.val();
          const voiceVal = data.voiceChatAgent !== undefined ? data.voiceChatAgent : (data.voiceEnabled !== undefined ? data.voiceEnabled : true);
          const photoVal = data.photoUploads !== undefined ? data.photoUploads : (data.photoUploadsEnabled !== undefined ? data.photoUploadsEnabled : true);
          
          // Check if calendar integration exists
          const calendarExists = Boolean(
            data.calendarActive !== false &&
            (data.calendarIntegration || data.calendarActive || data.integrations?.calendar || data.integrations?.GoogleCalendar || data.integrations?.Make || data.bookingRule)
          );
          // If the tenant's booking setting defaults to false or null, enforce a fallback that allows booking if calendar integration exists
          const directBooking = (data.enableDirectBooking === false || data.enableDirectBooking === null)
            ? (calendarExists ? true : false)
            : (data.enableDirectBooking !== undefined ? data.enableDirectBooking : (calendarExists || true));
          const calActive = (data.calendarActive === false || data.calendarActive === null)
            ? (calendarExists ? true : false)
            : (data.calendarActive !== undefined ? data.calendarActive : true);

          setConfig((prev) => ({
            ...prev,
            ...data,
            enableDirectBooking: directBooking,
            calendarActive: calActive,
            voiceChatAgent: voiceVal,
            photoUploads: photoVal,
            voiceEnabled: voiceVal,
            leadCaptureFields: data.leadCaptureFields || prev.leadCaptureFields,
            businessIntelligenceFields:
              data.businessIntelligenceFields ||
              prev.businessIntelligenceFields,
          }));
        }
      } catch (error) {
        showToast("Failed to load settings.", "error");
      } finally {
        setIsLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === "checkbox" ? checked : value;
    setConfig((prev) => ({
      ...prev,
      [name]: val,
      ...(name === "voiceChatAgent" ? { voiceEnabled: val } : {}),
      ...(name === "voiceEnabled" ? { voiceChatAgent: val } : {}),
    }));
  };

  const handleAvatarSelect = (avatarId) => {
    setConfig((prev) => ({ ...prev, botAvatar: avatarId }));
  };

  const handleArrayChange = (index, field, value) => {
    const newArray = [...config[field]];
    newArray[index] = value;
    setConfig((prev) => ({ ...prev, [field]: newArray }));
  };

  const addArrayItem = (field, emptyValue = "") =>
    setConfig((prev) => ({ ...prev, [field]: [...prev[field], emptyValue] }));

  const removeArrayItem = (index, field) => {
    const newArray = config[field].filter((_, i) => i !== index);
    setConfig((prev) => ({
      ...prev,
      [field]: newArray.length ? newArray : [""],
    }));
  };

  const handleFaqChange = (index, key, value) => {
    const newFaqs = [...config.faqs];
    newFaqs[index][key] = value;
    setConfig((prev) => ({ ...prev, faqs: newFaqs }));
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    const fallbackDefault = "General default information";

    const ensureValue = (val) => {
      if (val === undefined || val === null) return fallbackDefault;
      if (typeof val === "string" && val.trim() === "") return fallbackDefault;
      return val;
    };

    const ensureArray = (arr) => {
      if (!Array.isArray(arr) || arr.length === 0) return [fallbackDefault];
      const cleaned = arr
        .map((item) => (typeof item === "string" ? item.trim() : item))
        .filter((item) => item !== "" && item !== undefined && item !== null);
      return cleaned.length > 0 ? cleaned : [fallbackDefault];
    };

    const ensureFaqs = (faqs) => {
      if (!Array.isArray(faqs) || faqs.length === 0) {
        return [{ question: fallbackDefault, answer: fallbackDefault }];
      }
      const cleaned = faqs
        .map((f) => ({
          question: ensureValue(f?.question),
          answer: ensureValue(f?.answer),
        }))
        .filter((f) => f.question !== fallbackDefault || f.answer !== fallbackDefault);
      return cleaned.length > 0 ? cleaned : [{ question: fallbackDefault, answer: fallbackDefault }];
    };

    // Construct payload ensuring every input field is present and validated against null/empty
    const cleanedConfig = {
      serviceCategory: ensureValue(config.serviceCategory),
      botAvatar: ensureValue(config.botAvatar),
      customAvatarSvg: ensureValue(config.customAvatarSvg),
      botName: ensureValue(config.botName),
      launcherText: ensureValue(config.launcherText),
      themeColor: ensureValue(config.themeColor),
      greetingMessage: ensureValue(config.greetingMessage),
      botIdentity: ensureValue(config.botIdentity),
      companyContext: ensureValue(config.companyContext),
      customRules: ensureValue(config.customRules),
      additionalConversationalRules: ensureValue(config.additionalConversationalRules),
      tone: ensureValue(config.tone),
      botVoice: ensureValue(config.botVoice),
      basePrompt: ensureValue(config.basePrompt),
      leadCaptureFields: ensureArray(config.leadCaptureFields),
      businessIntelligenceFields: ensureArray(config.businessIntelligenceFields),
      services: ensureArray(config.services),
      faqs: ensureFaqs(config.faqs),
      qualificationQuestions: ensureArray(config.qualificationQuestions),
      escalationRule: ensureValue(config.escalationRule),
      bookingRule: ensureValue(config.bookingRule),
      unavailableBehavior: ensureValue(config.unavailableBehavior),
      aiModel: ensureValue(config.aiModel),
      temperature: typeof config.temperature === "number" ? config.temperature : (parseFloat(config.temperature) || 0.4),
      strictValidation: Boolean(config.strictValidation),
      voiceChatAgent: config.voiceChatAgent !== false,
      photoUploads: config.photoUploads !== false,
      voiceEnabled: config.voiceChatAgent !== false,
      enableDirectBooking: (() => {
        const calExists = Boolean(
          config.calendarActive !== false &&
          (config.calendarIntegration || config.calendarActive || config.integrations?.calendar || config.integrations?.GoogleCalendar || config.integrations?.Make || config.bookingRule)
        );
        return (config.enableDirectBooking === false || config.enableDirectBooking === null)
          ? (calExists ? true : false)
          : (config.enableDirectBooking !== undefined ? config.enableDirectBooking : (calExists || true));
      })(),
      calendarActive: (() => {
        const calExists = Boolean(
          config.calendarActive !== false &&
          (config.calendarIntegration || config.calendarActive || config.integrations?.calendar || config.integrations?.GoogleCalendar || config.integrations?.Make || config.bookingRule)
        );
        return (config.calendarActive === false || config.calendarActive === null)
          ? (calExists ? true : false)
          : (config.calendarActive !== undefined ? config.calendarActive : true);
      })(),
    };

    // Strict fallback validation: ensure no field remains null, undefined, or empty string
    Object.keys(cleanedConfig).forEach((key) => {
      const val = cleanedConfig[key];
      if (val === undefined || val === null || (typeof val === "string" && val.trim() === "")) {
        cleanedConfig[key] = fallbackDefault;
      }
    });

    try {
      await set(ref(db, "settings/chatbot_config"), {
        ...cleanedConfig,
        updated_at: new Date().toISOString(),
      });
      
      // 🚨 TICKET 14: Log Configuration Change with Previous and New state
      recordAuditTrail(pulseLogger, "configuration_changed", {
        who: localStorage.getItem("currentSuperAdmin") || localStorage.getItem("currentUser") || "unknown",
        target: "settings/chatbot_config",
        previousState: config, 
        newState: cleanedConfig 
      });
      
      setConfig(cleanedConfig);
      showToast("Chatbot settings updated successfully!", "success");
    } catch (error) {
      showToast("Failed to save changes.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestVoice = async () => {
    if (!config.greetingMessage || !config.botVoice) return;

    if (window.currentTestAudio) {
      window.currentTestAudio.pause();
      window.currentTestAudio.currentTime = 0;
    }

    setIsPlayingTest(true);
    try {
      const cleanText = config.greetingMessage.replace(/[^\w\s,.!?]/gi, "");
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: cleanText,
          voiceId: config.botVoice,
        }),
      });

      if (!response.ok) throw new Error("TTS request failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      window.currentTestAudio = audio;

      audio.onended = () => setIsPlayingTest(false);
      audio.onerror = () => setIsPlayingTest(false);

      audio.play();
    } catch (error) {
      console.error("Test voice error:", error);
      showToast("Failed to play voice test.", "error");
      setIsPlayingTest(false);
    }
  };

  if (isLoading)
    return (
      <div className="cd-page" role="status" aria-live="polite">
        <div className="cd-page__head">
          <div className="flex flex-col gap-2">
            <span className="cd-skel h-7 w-64 max-w-full" />
            <span className="cd-skel h-4 w-[28rem] max-w-full" />
          </div>
        </div>
        <div className="cd-panel">
          <div className="cd-panel__body flex flex-col gap-4">
            <p className="cd-meta">Loading AI Config…</p>
            <span className="cd-skel h-9 w-full" />
            <span className="cd-skel h-9 w-2/3" />
            <span className="cd-skel h-24 w-full" />
          </div>
        </div>
      </div>
    );

  const getActiveAvatarSrc = () => {
    if (config.botAvatar === "custom") {
      if (
        config.customAvatarSvg &&
        config.customAvatarSvg.trim().startsWith("<svg")
      ) {
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(config.customAvatarSvg)}`;
      }
      return `data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 20h9'%3E%3C/path%3E%3Cpath d='M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z'%3E%3C/path%3E%3C/svg%3E`;
    }
    const selected = AVATAR_OPTIONS.find((a) => a.id === config.botAvatar);
    return selected?.src || AVATAR_OPTIONS[0].src;
  };

  const activeAvatarSrc = getActiveAvatarSrc();

  return (
    <div className="cd-page">
      <div className="cd-page__head">
        <div>
          <h1 className="cd-h1">Chatbot Settings</h1>
          <p className="cd-sub">
            Configure your AI agent&apos;s branding, prompts, knowledge, and
            operational rules.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSaveConfig}
          disabled={isSaving}
          aria-busy={isSaving}
          className="cd-btn"
        >
          {isSaving && <span className="cd-spinner keep-motion" aria-hidden="true" />}
          {isSaving ? "Saving…" : "Save AI Rules"}
        </button>
      </div>

      <div className="cd-grid items-start">
        {/* LEFT COLUMN (Identity & Persona) */}
        <div className="cd-span-6 flex flex-col gap-[var(--space-lg)]">
          <section className="cd-panel">
            <div className="cd-panel__head">
              <h2 className="cd-h2">Display & Branding</h2>
            </div>
            <div className="cd-panel__body flex flex-col gap-5">
              <div className="cd-grid">
                <label className="cd-field cd-span-6">
                  <span className="cd-label inline-flex items-center">
                    Chatbot Name
                    <InfoTooltip text="The public-facing name visitors will see at the top of the chat window." />
                  </span>
                  <input
                    name="botName"
                    value={config.botName}
                    onChange={handleInputChange}
                    className="cd-input"
                  />
                </label>
                <label className="cd-field cd-span-6">
                  <span className="cd-label inline-flex items-center">
                    Launcher Text
                    <InfoTooltip text="The text displayed next to the chat bubble before the user opens the widget." />
                  </span>
                  <input
                    name="launcherText"
                    value={config.launcherText}
                    onChange={handleInputChange}
                    className="cd-input"
                  />
                </label>
              </div>

              <hr className="cd-divider" />

              <fieldset className="flex min-w-0 flex-col gap-3">
                <legend className="cd-label mb-3">
                  Bot Avatar Graphic
                </legend>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {AVATAR_OPTIONS.map((avatar) => {
                    const isSelected = config.botAvatar === avatar.id;
                    let imgSrc = avatar.src;

                    if (avatar.isCustom) {
                      imgSrc =
                        config.customAvatarSvg &&
                        config.customAvatarSvg.trim().startsWith("<svg")
                          ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(config.customAvatarSvg)}`
                          : `data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 20h9'%3E%3C/path%3E%3Cpath d='M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z'%3E%3C/path%3E%3C/svg%3E`;
                    }

                    return (
                      <button
                        key={avatar.id}
                        type="button"
                        onClick={() => handleAvatarSelect(avatar.id)}
                        aria-pressed={isSelected}
                        className={`flex min-w-0 flex-col items-center justify-center gap-2 rounded-control border px-1 py-2.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${isSelected ? "border-signal bg-selected" : "border-rule hover:bg-hover"}`}
                      >
                        <span className="flex h-7 w-7 items-center justify-center">
                          <img
                            src={imgSrc}
                            alt={avatar.label}
                            className={`h-full w-full object-contain ${!isSelected ? "opacity-60 grayscale" : "opacity-100"}`}
                          />
                        </span>
                        <span
                          className={`text-center text-[length:var(--text-2xs)] leading-tight ${isSelected ? "font-semibold text-ink" : "font-medium text-ink-2"}`}
                        >
                          {avatar.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {config.botAvatar === "custom" && (
                  <div className="cd-well">
                    <label className="cd-field">
                      <span className="cd-label inline-flex items-center">
                        Paste Custom SVG Code
                        <InfoTooltip text="Paste raw <svg>...</svg> code here. It will be saved directly to your database." />
                      </span>
                      <textarea
                        name="customAvatarSvg"
                        value={config.customAvatarSvg}
                        onChange={handleInputChange}
                        placeholder="<svg viewBox='0 0 24 24'>...</svg>"
                        rows="3"
                        className="cd-textarea font-mono text-[length:var(--text-xs)]"
                      />
                    </label>
                  </div>
                )}
              </fieldset>

              <hr className="cd-divider" />

              <label className="cd-field">
                <span className="cd-label inline-flex items-center">
                  Initial Greeting Message
                  <InfoTooltip text="The very first message the bot sends to engage the user when they open the chat." />
                </span>
                <textarea
                  name="greetingMessage"
                  value={config.greetingMessage}
                  onChange={handleInputChange}
                  rows="2"
                  className="cd-textarea"
                />
              </label>

              <div className="cd-field">
                <div className="flex items-center justify-between gap-3">
                  <span className="cd-label inline-flex items-center">
                    Bot Voice
                    <InfoTooltip text="The vocal identity used if the chatbot responds via audio." />
                  </span>
                  <button
                    type="button"
                    onClick={handleTestVoice}
                    disabled={isPlayingTest || !config.greetingMessage}
                    aria-busy={isPlayingTest}
                    className="cd-btn cd-btn--ghost cd-btn--sm"
                  >
                    {isPlayingTest ? (
                      <>
                        <Volume2 aria-hidden="true" />
                        <span>Playing…</span>
                      </>
                    ) : (
                      <>
                        <Volume2 aria-hidden="true" />
                        <span>Test voice</span>
                      </>
                    )}
                  </button>
                </div>
                <select
                  name="botVoice"
                  value={config.botVoice}
                  onChange={handleInputChange}
                  aria-label="Bot Voice"
                  className="cd-select"
                >
                  <option value="ash">Ash (Balanced & Clear)</option>
                  <option value="Joanna">Joanna (Female, US)</option>
                  <option value="Matthew">Matthew (Male, US)</option>
                  <option value="Salli">Salli (Female, US)</option>
                  <option value="Justin">Justin (Male, US)</option>
                  <option value="Ruth">Ruth (Female, US)</option>
                  <option value="Stephen">Stephen (Male, US)</option>
                </select>
              </div>
            </div>
          </section>

          <section className="cd-panel">
            <div className="cd-panel__head">
              <h2 className="cd-h2">Feature Toggles</h2>
            </div>
            <div className="cd-panel__body flex flex-col gap-4">
              <label className="flex cursor-pointer items-start justify-between gap-4">
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="cd-label inline-flex items-center">
                    VoiceChatAgent
                    <InfoTooltip text="Enable or disable real-time AI voice conversation." />
                  </span>
                  <span className="cd-meta">
                    Allow visitors to start a voice call with the AI agent.
                  </span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  name="voiceChatAgent"
                  checked={Boolean(config.voiceChatAgent)}
                  onChange={handleInputChange}
                  className="cd-switch mt-0.5"
                />
              </label>

              <hr className="cd-divider" />

              <label className="flex cursor-pointer items-start justify-between gap-4">
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="cd-label inline-flex items-center">
                    Photo Uploads
                    <InfoTooltip text="Enable or disable photo upload and camera snapshot capability." />
                  </span>
                  <span className="cd-meta">
                    Allow visitors to capture or upload images for diagnostic analysis.
                  </span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  name="photoUploads"
                  checked={Boolean(config.photoUploads)}
                  onChange={handleInputChange}
                  className="cd-switch mt-0.5"
                />
              </label>
            </div>
          </section>

          <section className="cd-panel">
            <div className="cd-panel__head">
              <h2 className="cd-h2">Prompt Engineering & Persona</h2>
            </div>
            <div className="cd-panel__body flex flex-col gap-5">
              <div className="cd-well cd-grid">
                <label className="cd-field cd-span-6">
                  <span className="cd-label inline-flex items-center">
                    LLM Engine
                    <InfoTooltip text="Select the AI brain. 'mini' models are fast and cheap. Full models are smarter for complex tasks." />
                  </span>
                  <select
                    name="aiModel"
                    value={config.aiModel}
                    onChange={handleInputChange}
                    className="cd-select"
                  >
                    <option value="gpt-4o-mini">gpt-4o-mini (Fastest)</option>
                    <option value="gpt-4o">gpt-4o (High Logic)</option>
                    <option value="gpt-4-turbo">gpt-4-turbo</option>
                    <option value="gpt-4">gpt-4 (Standard)</option>
                    <option value="gpt-3.5-turbo">
                      gpt-3.5-turbo (Legacy)
                    </option>
                  </select>
                </label>
                <label className="cd-field cd-span-6">
                  <span className="cd-label inline-flex items-center">
                    Temperature (<span className="cd-num">{config.temperature}</span>)
                    <InfoTooltip text="Lower values (0.1) make the bot strict. Higher values (0.7) make it creative." />
                  </span>
                  <input
                    type="range"
                    min="0.0"
                    max="0.9"
                    step="0.1"
                    name="temperature"
                    value={config.temperature}
                    onChange={handleInputChange}
                    className="h-[var(--control-h)] w-full cursor-pointer rounded-control accent-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  />
                </label>
                <div className="cd-span-12 flex flex-col gap-1">
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      name="strictValidation"
                      checked={config.strictValidation}
                      onChange={handleInputChange}
                      className="cd-check"
                    />
                    <span className="cd-label">Strict Formats</span>
                    <InfoTooltip text="If checked, the AI rejects invalid emails/phone numbers. Uncheck to allow fluid, conversational data entry." />
                  </label>
                  <p className="cd-meta pl-6">
                    Enforce regex checks.
                  </p>
                </div>
              </div>

              <div className="cd-grid">
                <label className="cd-field cd-span-12">
                  <span className="cd-label inline-flex items-center">
                    Core System Prompt Override
                    <InfoTooltip text="The fundamental instructions driving the AI. Tell it its ultimate goal." />
                  </span>
                  <textarea
                    name="basePrompt"
                    value={config.basePrompt}
                    onChange={handleInputChange}
                    rows="4"
                    className="cd-textarea"
                  />
                </label>

                <label className="cd-field cd-span-6">
                  <span className="cd-label inline-flex items-center">
                    Bot Identity / Role
                    <InfoTooltip text="Who the AI thinks it is. Helps set context for the LLM." />
                  </span>
                  <input
                    name="botIdentity"
                    value={config.botIdentity}
                    onChange={handleInputChange}
                    className="cd-input"
                  />
                </label>

                {/* --- NEW SERVICE CATEGORY FIELD --- */}
                <label className="cd-field cd-span-6">
                  <span className="cd-label inline-flex items-center">
                    Service Category (Industry)
                    <InfoTooltip text="Select your industry to load optimized AI chat flows and vision diagnostics." />
                  </span>
                  <select
                    name="serviceCategory"
                    value={config.serviceCategory || "General"}
                    onChange={handleInputChange}
                    className="cd-select"
                  >
                    <option value="General">General / Software</option>
                    <option value="HVAC">HVAC & Air Conditioning</option>
                    <option value="Plumbing">Plumbing</option>
                    <option value="Pest Control">Pest Control</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Roofing">Roofing</option>
                    <option value="Appliance Repair">Appliance Repair</option>
                  </select>
                </label>

                <label className="cd-field cd-span-12">
                  <span className="cd-label inline-flex items-center">
                    Company Context
                    <InfoTooltip text="A brief description of your business. The AI uses this to answer general inquiries." />
                  </span>
                  <textarea
                    name="companyContext"
                    value={config.companyContext}
                    onChange={handleInputChange}
                    rows="3"
                    className="cd-textarea"
                  />
                </label>

                <label className="cd-field cd-span-6">
                  <span className="cd-label inline-flex items-center">
                    Bot Tone
                    <InfoTooltip text="Dictates the vocabulary and conversational style of the AI." />
                  </span>
                  <select
                    name="tone"
                    value={config.tone}
                    onChange={handleInputChange}
                    className="cd-select"
                  >
                    <option value="Warm, Conversational & Human-like">
                      Warm, Conversational & Human-like
                    </option>
                    <option value="Friendly & Empathetic">
                      Friendly & Empathetic
                    </option>
                    <option value="Casual & Humorous">Casual & Humorous</option>
                    <option value="Professional & Direct">
                      Professional & Direct
                    </option>
                  </select>
                </label>
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN (Rules, Flow & Data) */}
        <div className="cd-span-6 flex flex-col gap-[var(--space-lg)]">
          <section className="cd-panel">
            <div className="cd-panel__head">
              <h2 className="cd-h2">See CloseDesk in action</h2>
            </div>
            <div className="cd-panel__body">
              <div className="cd-well mx-auto flex w-full max-w-sm flex-col gap-3 p-0">
                <div className="flex items-center gap-3 border-b border-rule px-4 py-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper-3 p-1.5">
                    <img
                      src={activeAvatarSrc}
                      alt="Selected Avatar"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="cd-h3 truncate">
                      {config.botName || "Bot Name"}
                    </h3>
                    <span className="cd-badge cd-badge--success mt-1">
                      Online
                    </span>
                  </div>
                </div>
                <div className="flex min-h-[120px] flex-col gap-3 px-4 pb-4">
                  <p className="max-w-[85%] rounded-control rounded-tl-none bg-paper-3 px-3 py-2 text-[length:var(--text-xs)] text-ink">
                    {config.greetingMessage || "Hello there!"}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="cd-panel">
            <div className="cd-panel__head">
              <h2 className="cd-h2">Chat Flow & Rules</h2>
            </div>
            <div className="cd-panel__body flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="cd-label inline-flex items-center">
                    Lead Capture Fields
                    <InfoTooltip text="Contact details the AI should naturally try to collect during the conversation (without gatekeeping)." />
                  </span>
                  <button
                    type="button"
                    onClick={() => addArrayItem("leadCaptureFields")}
                    className="cd-btn cd-btn--ghost cd-btn--sm"
                  >
                    <Plus aria-hidden="true" />
                    Add Field
                  </button>
                </div>
                <div className="-mx-1 flex max-h-44 flex-col gap-2 overflow-y-auto px-1 py-1 custom-scrollbar">
                  {config.leadCaptureFields.map((field, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="cd-num w-6 shrink-0 text-right text-[length:var(--text-xs)] text-ink-2">
                        {index + 1}.
                      </span>
                      <input
                        type="text"
                        value={field}
                        onChange={(e) =>
                          handleArrayChange(
                            index,
                            "leadCaptureFields",
                            e.target.value,
                          )
                        }
                        aria-label={`Lead Capture Fields ${index + 1}`}
                        className="cd-input"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          removeArrayItem(index, "leadCaptureFields")
                        }
                        aria-label="Remove"
                        className="cd-icon-btn"
                      >
                        <X aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <hr className="cd-divider" />

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="cd-label inline-flex items-center">
                    Business Intelligence Fields
                    <InfoTooltip text="Hidden details (like Industry or Budget) the AI silently listens for and extracts without aggressively asking." />
                  </span>
                  <button
                    type="button"
                    onClick={() => addArrayItem("businessIntelligenceFields")}
                    className="cd-btn cd-btn--ghost cd-btn--sm"
                  >
                    <Plus aria-hidden="true" />
                    Add Field
                  </button>
                </div>
                <div className="-mx-1 flex max-h-44 flex-col gap-2 overflow-y-auto px-1 py-1 custom-scrollbar">
                  {config.businessIntelligenceFields.map((field, index) => (
                    <div
                      key={`bi-${index}`}
                      className="flex items-center gap-2"
                    >
                      <span className="cd-num w-6 shrink-0 text-right text-[length:var(--text-xs)] text-ink-2">
                        {index + 1}.
                      </span>
                      <input
                        type="text"
                        value={field}
                        onChange={(e) =>
                          handleArrayChange(
                            index,
                            "businessIntelligenceFields",
                            e.target.value,
                          )
                        }
                        aria-label={`Business Intelligence Fields ${index + 1}`}
                        className="cd-input"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          removeArrayItem(index, "businessIntelligenceFields")
                        }
                        aria-label="Remove"
                        className="cd-icon-btn"
                      >
                        <X aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <hr className="cd-divider" />

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="cd-label inline-flex items-center">
                    Qualification Questions
                    <InfoTooltip text="Questions the AI should ask organically to determine if the lead is high quality." />
                  </span>
                  <button
                    type="button"
                    onClick={() => addArrayItem("qualificationQuestions")}
                    className="cd-btn cd-btn--ghost cd-btn--sm"
                  >
                    <Plus aria-hidden="true" />
                    Add Question
                  </button>
                </div>
                <div className="-mx-1 flex max-h-44 flex-col gap-2 overflow-y-auto px-1 py-1 custom-scrollbar">
                  {config.qualificationQuestions.map((q, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={q}
                        onChange={(e) =>
                          handleArrayChange(
                            index,
                            "qualificationQuestions",
                            e.target.value,
                          )
                        }
                        aria-label={`Qualification Questions ${index + 1}`}
                        className="cd-input"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          removeArrayItem(index, "qualificationQuestions")
                        }
                        aria-label="Remove"
                        className="cd-icon-btn"
                      >
                        <X aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <hr className="cd-divider" />

              <label className="cd-field">
                <span className="cd-label inline-flex items-center">
                  Custom Behavioral Rules
                  <InfoTooltip text="General do's and don'ts. E.g., 'Never mention pricing. Keep answers under 2 sentences.'" />
                </span>
                <textarea
                  name="customRules"
                  value={config.customRules}
                  onChange={handleInputChange}
                  rows="3"
                  className="cd-textarea"
                />
              </label>

              <label className="cd-field">
                <span className="cd-label inline-flex items-center">
                  Conversational Rules (Strict Flow)
                  <InfoTooltip text="Directives on how the AI should talk. E.g., 'Always end with a question' or 'Never use bullet points'." />
                </span>
                <textarea
                  name="additionalConversationalRules"
                  value={config.additionalConversationalRules}
                  onChange={handleInputChange}
                  placeholder="1. Always end with a question.&#10;2. Never use emojis."
                  rows="3"
                  className="cd-textarea"
                />
              </label>
            </div>
          </section>

          <section className="cd-panel">
            <div className="cd-panel__head">
              <h2 className="cd-h2">Knowledge & Routing</h2>
            </div>
            <div className="cd-panel__body flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="cd-label inline-flex items-center">
                    Services Offered
                    <InfoTooltip text="Keywords for your services. If a user asks what you offer, the AI references this list." />
                  </span>
                  <button
                    type="button"
                    onClick={() => addArrayItem("services")}
                    className="cd-btn cd-btn--ghost cd-btn--sm"
                  >
                    <Plus aria-hidden="true" />
                    Add Service
                  </button>
                </div>
                <div className="-mx-1 flex max-h-44 flex-col gap-2 overflow-y-auto px-1 py-1 custom-scrollbar">
                  {config.services.map((service, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={service}
                        onChange={(e) =>
                          handleArrayChange(index, "services", e.target.value)
                        }
                        aria-label={`Services Offered ${index + 1}`}
                        className="cd-input"
                      />
                      <button
                        type="button"
                        onClick={() => removeArrayItem(index, "services")}
                        aria-label="Remove"
                        className="cd-icon-btn"
                      >
                        <X aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <hr className="cd-divider" />

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="cd-label inline-flex items-center">
                    FAQs
                    <InfoTooltip text="Pre-feed exact answers to common questions. The AI will prioritize these over generating a random response." />
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      addArrayItem("faqs", { question: "", answer: "" })
                    }
                    className="cd-btn cd-btn--ghost cd-btn--sm"
                  >
                    <Plus aria-hidden="true" />
                    Add FAQ
                  </button>
                </div>
                <div className="-mx-1 flex max-h-72 flex-col gap-3 overflow-y-auto px-1 py-1 custom-scrollbar">
                  {config.faqs.map((faq, index) => (
                    <div
                      key={index}
                      className="cd-well flex items-start gap-2 p-3"
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <input
                          type="text"
                          value={faq.question}
                          onChange={(e) =>
                            handleFaqChange(index, "question", e.target.value)
                          }
                          placeholder="Question"
                          aria-label="Question"
                          className="cd-input font-semibold"
                        />
                        <textarea
                          value={faq.answer}
                          onChange={(e) =>
                            handleFaqChange(index, "answer", e.target.value)
                          }
                          placeholder="Answer"
                          aria-label="Answer"
                          rows="2"
                          className="cd-textarea min-h-[4.5rem]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeArrayItem(index, "faqs")}
                        aria-label="Remove"
                        className="cd-icon-btn"
                      >
                        <X aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <hr className="cd-divider" />

              <label className="cd-field">
                <span className="cd-label inline-flex items-center">
                  Booking Calendar Rules
                  <InfoTooltip text="Controls when the bot is allowed to flag a conversation as 'ready_to_book'." />
                </span>
                <select
                  name="bookingRule"
                  value={config.bookingRule}
                  onChange={handleInputChange}
                  className="cd-select"
                >
                  <option value="require_all">
                    Require Phone & Email before booking
                  </option>
                  <option value="require_email">Require Email only</option>
                  <option value="book_direct">
                    Allow direct booking immediately
                  </option>
                </select>
              </label>

              <label className="cd-field">
                <span className="cd-label inline-flex items-center">
                  Escalation Behavior
                  <InfoTooltip text="What happens if the AI is asked something completely outside its knowledge base." />
                </span>
                <select
                  name="escalationRule"
                  value={config.escalationRule}
                  onChange={handleInputChange}
                  className="cd-select"
                >
                  <option value="email_admin">
                    Take a message and email Admin
                  </option>
                  <option value="provide_phone">
                    Provide support phone number
                  </option>
                </select>
              </label>

              <label className="cd-field">
                <span className="cd-label inline-flex items-center">
                  After-Hours Behavior
                  <InfoTooltip text="How the AI handles inquiries outside of standard 9-5 business hours." />
                </span>
                <select
                  name="unavailableBehavior"
                  value={config.unavailableBehavior}
                  onChange={handleInputChange}
                  className="cd-select"
                >
                  <option value="collect_lead">
                    Collect Email & Promise Next-Day Callback
                  </option>
                  <option value="standard">
                    Ignore hours and act normally
                  </option>
                </select>
              </label>
            </div>
          </section>
        </div>
      </div>

      <div
        role="status"
        aria-live="polite"
        className={`cd-toast transition-opacity ${toast.show ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        {toast.type === "error" ? (
          <CircleAlert aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
        ) : (
          <CircleCheck aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-[length:var(--text-2xs)] font-semibold">
            System Notice
          </p>
          <p className="font-medium">{toast.message}</p>
        </div>
      </div>
    </div>
  );
}
