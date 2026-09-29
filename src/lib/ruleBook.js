// // src/lib/ruleBook.js
// import { db } from "./firebase";
// import { ref, get } from "firebase/database";

// /**
//  * ============================================================================
//  * SINGLE SOURCE OF TRUTH ARCHITECTURE & BOUNDARIES
//  * ============================================================================
//  * Policy Version: 2.11.0
//  *
//  * --- VOICE ROLLBACK PROCEDURE (KILL SWITCH) ---
//  * If production issues occur with the Realtime Voice API (e.g., latency,
//  * hallucination, or abuse), you can disable the Voice Agent without affecting
//  * the Text Chatbot.
//  *
//  * HOW TO DISABLE:
//  * 1. In Firebase Realtime Database, navigate to `settings/chatbot_config`.
//  * 2. Add or set the boolean field `"voiceEnabled": false`.
//  * 3. The frontend will immediately hide the Voice switch button, and the
//  *    /api/openai-token endpoint will block further connection attempts.
//  * ============================================================================
//  */
// export const POLICY_VERSION = "2.11.0";

// export async function getMasterRuleBook(
//   mode = "text",
//   currentLeadData = null,
//   retrievedKnowledge = "",
// ) {
//   let botConfig = {
//     botIdentity: "the 'AI Front Desk' for Aicyro",
//     companyContext:
//       "We provide automated AI business systems and digital products.",
//     customRules:
//       "Speak naturally. Use conversational filler words occasionally. Keep it empathetic.",
//     tone: "Warm, Conversational & Human-like",
//     capabilities: [
//       "AI Voice Agent",
//       "Text Chatbot",
//       "Automated Booking",
//       "Website Audit",
//     ],
//     integrations: {
//       Zapier: "STANDARD",
//       Make: "STANDARD",
//       GoHighLevel: "WEBHOOK_API",
//       HubSpot: "CUSTOM",
//       Salesforce: "UNDER_EVALUATION",
//     },
//     approvedPricing: [
//       { tier: "Starter", price: "$97/month", description: "Text Chatbot" },
//       { tier: "Pro", price: "$297/month", description: "Voice & Text AI" },
//     ],
//     objections: {
//       "Existing contact form":
//         "Forms are passive. CloseDesk engages immediately and qualifies leads in real-time.",
//       "Existing chatbot":
//         "Most bots are rigid decision trees. CloseDesk uses conversational AI to adapt fluidly to the user.",
//       "Phone preference":
//         "CloseDesk includes a Voice AI agent that handles phone calls naturally.",
//       "Customer resistance":
//         "The AI is designed to be warm and conversational, and it seamlessly escalates to humans when needed.",
//       Price:
//         "It's an investment in capturing leads that would otherwise go to competitors after hours or during busy times.",
//     },
//     faqs: [],
//     qualificationQuestions: [],
//     leadCaptureFields: ["Name", "Email", "Phone"],
//     businessIntelligenceFields: [
//       "Industry",
//       "Business Problem",
//       "Current Process",
//       "Desired Outcome",
//       "Interested Capability",
//       "Current Software",
//       "Website",
//     ],
//     escalationRule: "email_admin",
//     bookingRule: "require_all",
//     unavailableBehavior: "collect_lead",
//     aiModel: "gpt-4o-mini",

//     // --- VOICE FEATURE FLAG & CONFIG ---
//     voiceEnabled: true, // Master kill switch
//     aiVoiceModel: "gpt-realtime-2.1-mini",
//     voice: "ash",

//     temperature: 0.4,
//     strictValidation: false,

//     turnDetection: {
//       type: "server_vad",
//       threshold: 0.8,
//       prefix_padding_ms: 300,
//       silence_duration_ms: 800,
//     },
//   };

//   try {
//     const snapshot = await get(ref(db, "settings/chatbot_config"));
//     if (snapshot.exists()) {
//       const data = snapshot.val();
//       botConfig = {
//         ...botConfig,
//         ...data,
//         capabilities:
//           data.capabilities || data.services || botConfig.capabilities,
//         integrations: data.integrations || botConfig.integrations,
//         approvedPricing: data.approvedPricing || botConfig.approvedPricing,
//         objections: data.objections || botConfig.objections,
//       };
//     }
//   } catch (error) {
//     console.error("Failed to fetch config from Firebase.", error);
//   }

//   const today = new Date();
//   const dateString = today.toLocaleDateString("en-US", {
//     weekday: "long",
//     year: "numeric",
//     month: "long",
//     day: "numeric",
//   });
//   const currentHour = today.getHours();
//   const isAfterHours = currentHour < 9 || currentHour >= 17;

//   let hoursInstruction = "";
//   if (isAfterHours && botConfig.unavailableBehavior === "collect_lead") {
//     hoursInstruction =
//       "Note: It is currently AFTER HOURS. If the user wants to speak to a human, let them know the team is away but you can take their details for a callback.";
//   }

//   let instructions = `[SYSTEM POLICY VERSION: ${POLICY_VERSION}]
// You are ${botConfig.botIdentity}. You act as a ${botConfig.tone} assistant.
// Today's current date is ${dateString}.

// COMPANY CONTEXT & KNOWLEDGE:
// Company Context: ${botConfig.companyContext}
// Capabilities: ${botConfig.capabilities?.length ? botConfig.capabilities.join(", ") : "N/A"}
// Approved Pricing: ${botConfig.approvedPricing?.length ? JSON.stringify(botConfig.approvedPricing) : "Unlisted"}

// FLUID CONVERSATIONAL RULES (CRITICAL):
// 1. OUT-OF-BOUNDS GUARDRAIL (STRICT): You are the AI Front Desk for CloseDesk. Politely refuse unrelated topics and steer back to how CloseDesk helps their business.
// 2. CUSTOMER COMES FIRST: Answer questions thoroughly before requesting lead details.
// 3. CONTEXTUAL NEXT STEP & CTA (CRITICAL):
//    - Ask if they would like to **book a demo/consultation** OR **request a callback** ONLY when it naturally fits the conversation. 
//    - DO NOT repeat this offer on every single turn.
//    - ONLY supply actionable shortcuts in "suggested_shortcuts" (e.g., ["Book a Demo", "Request a Callback"]) IF you are actively offering them. Otherwise, leave the array empty [].
// 4. 4. MEETING BOOKING & CALLBACK CAPTURE (UPDATED):
//    - **To book a meeting/demo:** You ONLY need to capture Name and Email. DO NOT ask the user for a preferred date or time! Tell the user: "I just need your name and email, and I'll bring up the calendar for you!" Once Name and Email are captured, set "next_action" to "SCHEDULE_CONSULTATION".
//    - **For a callback request:** Capture Name, Email, and Preferred time to call. Set "next_action" to "REQUEST_CALLBACK" and add "TRIGGER_CALLBACK" to "flags".
//    - IMPORTANT: Ask for their Phone Number as strictly OPTIONAL in both cases. Do not block the process if they skip the phone number.
//    - Immediately provide a clear confirmation message confirming their details.
// 5. HANDOFF & ESCALATION: If user requests a live human or audit, trigger immediately.
// 6. PRICING: Provide unnegotiated Approved Pricing directly.`;

//   if (mode === "text") {
//     instructions += `\n\nCURRENTLY COLLECTED DATA:\n${JSON.stringify(currentLeadData || {})}`;
//     instructions += `\n\n17. LENGTH CONSTRAINT: Keep responses under 2 to 3 short sentences.`;
//     instructions += `\n\nJSON OUTPUT REQUIREMENT:
// Output strictly as a raw JSON object matching this schema:
// {
//   "reply": "Your conversational response confirming or offering next steps...",
//   "suggested_shortcuts": ["Book a Demo", "Request a Callback"],
//   "context_patch": { 
//     "contact_info": { "name": null, "email": null, "phone": null }, 
//     "business_context": { "industry": null, "business_problem": null, "website": null },
//     "booking_request": {
//       "request_type": "consultation | callback | none",
//       "preferred_date": "string | null",
//       "preferred_time": "string | null"
//     }
//   },
//   "privacy_patch": [],
//   "intent_object": [],
//   "lead_temperature": "HIGH | MEDIUM | EDUCATIONAL_LOW_INTENT | UNKNOWN",
//   "lead_temperature_reason": null,
//   "urgency_level": "High | Medium | Low", 
//   "flags": ["TRIGGER_CALLBACK", "TRIGGER_DATA_DELETION"],
//   "analytics_events": [],
//   "state": "string",
//   "next_action": "SCHEDULE_CONSULTATION | REQUEST_CALLBACK | NONE",
//   "factual_summary": null
// }`;
//   } else if (mode === "voice") {
//     instructions += `\n\n17. VOICE PACING, BREVITY & STT ACCURACY (CRITICAL):
// - NO GREETING LOOPS: Never repeat greetings like "Welcome back" or "Hi again" during an active session.
// - IGNORE FILLERS & NOISE: Ignore "yeah", "ok", or empty noise. Remain silent.
// - PROGRESSIVE CAPTURE & PRIVACY: If a user refuses to provide a piece of information, accept it gracefully. Use 'record_privacy_preference' to log it. Offer an alternative path in a short spoken response.
// - CONCISE TURNS: Default to 1-3 short sentences maximum per turn. Never monologue. Maximum ONE question per turn.
// - CHUNK LONG EXPLANATIONS: Speak a short introductory part and explicitly ask whether the user wants to hear more.
// - STT CONFIRMATION PROTOCOL: You MUST explicitly verbally confirm Emails, Phone Numbers, Website URLs, and CRM/Software names before saving them.`;
//   }

//   return { instructions, botConfig };
// }


//
//
//
//
//
//
//
//
//


// src/lib/ruleBook.js
import { db } from "./firebase";
import { ref, get } from "firebase/database";

/**
 * ============================================================================
 * SINGLE SOURCE OF TRUTH ARCHITECTURE & BOUNDARIES
 * ============================================================================
 * Policy Version: 2.11.0
 *
 * --- VOICE ROLLBACK PROCEDURE (KILL SWITCH) ---
 * If production issues occur with the Realtime Voice API (e.g., latency,
 * hallucination, or abuse), you can disable the Voice Agent without affecting
 * the Text Chatbot.
 *
 * HOW TO DISABLE:
 * 1. In Firebase Realtime Database, navigate to `settings/chatbot_config`.
 * 2. Add or set the boolean field `"voiceEnabled": false`.
 * 3. The frontend will immediately hide the Voice switch button, and the
 *    /api/openai-token endpoint will block further connection attempts.
 * ============================================================================
 */
export const POLICY_VERSION = "2.11.0";

export async function getMasterRuleBook(
  mode = "text",
  currentLeadData = null,
  retrievedKnowledge = "",
) {
  let botConfig = {
    serviceCategory: "General", // Determines active industry flows
    botIdentity: "the 'AI Front Desk' for Aicyro",
    companyContext:
      "We provide automated AI business systems and digital products.",
    customRules:
      "Speak naturally. Use conversational filler words occasionally. Keep it empathetic.",
    tone: "Warm, Conversational & Human-like",
    capabilities: [
      "AI Voice Agent",
      "Text Chatbot",
      "Automated Booking",
      "Website Audit",
    ],
    integrations: {
      Zapier: "STANDARD",
      Make: "STANDARD",
      GoHighLevel: "WEBHOOK_API",
      HubSpot: "CUSTOM",
      Salesforce: "UNDER_EVALUATION",
    },
    approvedPricing: [
      { tier: "Starter", price: "$97/month", description: "Text Chatbot" },
      { tier: "Pro", price: "$297/month", description: "Voice & Text AI" },
    ],
    objections: {
      "Existing contact form":
        "Forms are passive. CloseDesk engages immediately and qualifies leads in real-time.",
      "Existing chatbot":
        "Most bots are rigid decision trees. CloseDesk uses conversational AI to adapt fluidly to the user.",
      "Phone preference":
        "CloseDesk includes a Voice AI agent that handles phone calls naturally.",
      "Customer resistance":
        "The AI is designed to be warm and conversational, and it seamlessly escalates to humans when needed.",
      Price:
        "It's an investment in capturing leads that would otherwise go to competitors after hours or during busy times.",
    },
    faqs: [],
    qualificationQuestions: [],
    leadCaptureFields: ["Name", "Email", "Phone"],
    businessIntelligenceFields: [
      "Industry",
      "Business Problem",
      "Current Process",
      "Desired Outcome",
      "Interested Capability",
      "Current Software",
      "Website",
    ],
    escalationRule: "email_admin",
    bookingRule: "require_all",
    unavailableBehavior: "collect_lead",
    aiModel: "gpt-4o-mini",

    // --- VOICE FEATURE FLAG & CONFIG ---
    voiceEnabled: true, // Master kill switch
    aiVoiceModel: "gpt-realtime-2.1-mini",
    voice: "ash",

    temperature: 0.4,
    strictValidation: false,

    turnDetection: {
      type: "server_vad",
      threshold: 0.8,
      prefix_padding_ms: 300,
      silence_duration_ms: 800,
    },
  };

  try {
    const snapshot = await get(ref(db, "settings/chatbot_config"));
    if (snapshot.exists()) {
      const data = snapshot.val();
      botConfig = {
        ...botConfig,
        ...data,
        capabilities:
          data.capabilities || data.services || botConfig.capabilities,
        integrations: data.integrations || botConfig.integrations,
        approvedPricing: data.approvedPricing || botConfig.approvedPricing,
        objections: data.objections || botConfig.objections,
      };
    }
  } catch (error) {
    console.error("Failed to fetch config from Firebase.", error);
  }

  const today = new Date();
  const dateString = today.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const currentHour = today.getHours();
  const isAfterHours = currentHour < 9 || currentHour >= 17;

  let hoursInstruction = "";
  if (isAfterHours && botConfig.unavailableBehavior === "collect_lead") {
    hoursInstruction =
      "Note: It is currently AFTER HOURS. If the user wants to speak to a human, let them know the team is away but you can take their details for a callback.";
  }

  // ==========================================
  // CATEGORY-SPECIFIC CHAT FLOWS
  // ==========================================
  let categorySpecificFlow = "";
  switch (botConfig.serviceCategory) {
    case "HVAC":
      categorySpecificFlow = `
### HVAC SPECIFIC PROTOCOL ###

1. SAFETY FIRST (CRITICAL & IMMEDIATE):
- If the user mentions gas smell, carbon-monoxide alarms, smoke, fire, or electrical-burning signs: 
  TREAT AS AN EMERGENCY. Advise the customer to move to safety and contact emergency services or their gas utility immediately. 
  STOP all technical troubleshooting. Set urgency_level to "Emergency" and prioritize human handoff.
- The assistant MUST NOT diagnose hazardous situations or provide risky step-by-step repair instructions.

2. CONDITIONAL DISCOVERY (DO NOT ASK AS A RIGID SCRIPT):
Only ask these if the information is missing and necessary for the next step:
- Ambiguous request: Ask what the main symptom or outcome is (e.g., no cooling, weak airflow, leak).
- System Type: Ask if it's an AC, furnace, heat pump, or mini-split, but ONLY if they know (no serial/model numbers needed).
- Urgency: Clarify if the system is completely down, partly working, or if it's just a maintenance/comfort issue. (Complete loss of heat/cooling in extreme weather = Urgent).
- Property Type: Ask if it's residential or commercial only if needed for routing.
- Replacement/Install: Ask for approximate age/current system ONLY if they want a quote for a new system. 
- Location: If dispatch or booking is requested, ask for their ZIP code or city to verify service area before proceeding.

3. DIAGNOSIS BOUNDARIES:
- Do NOT remotely diagnose the exact equipment failure.
- Do NOT provide step-by-step repair instructions. 

4. DATA EXTRACTION EXPECTATIONS (Map to 'business_context' JSON):
Extract these facts silently as the user provides them:
- hvac_service_type: (no_cooling, no_heat, maintenance, replacement, leak, etc.)
- system_type: (AC, furnace, heat pump, mini-split, unknown)
- system_status: (down, partial, maintenance, unknown)
- safety_trigger: (gas, CO, smoke, electrical_burning, none)
- property_type: (residential, commercial, unknown)
- customer_goal: (repair, maintenance, replace, quote, other)
`;
      break;
    case "Plumbing":
      categorySpecificFlow = `
### PLUMBING SPECIFIC PROTOCOL ###
- Identify the location of the issue (e.g., bathroom, kitchen, basement).
- Ask if there is active flooding or severe water damage. If YES, tell them to locate the main water shut-off valve immediately and treat as an EMERGENCY.
- Do not provide DIY pipe repair instructions. Focus on dispatching a technician.
`;
      break;
    case "Pest Control":
      categorySpecificFlow = `
### PEST CONTROL SPECIFIC PROTOCOL ###
- Identify the type of pest (rodents, insects, termites, etc.).
- Ask if the issue is indoors, outdoors, or both.
- Reassure them that technicians use pet-safe and child-safe treatments.
`;
      break;
  }

  let instructions = `[SYSTEM POLICY VERSION: ${POLICY_VERSION}]
You are ${botConfig.botIdentity}. You act as a ${botConfig.tone} assistant.
Today's current date is ${dateString}.
${hoursInstruction}

COMPANY CONTEXT & KNOWLEDGE:
Company Context: ${botConfig.companyContext}
Service Category: ${botConfig.serviceCategory || "General"}
Capabilities: ${botConfig.capabilities?.length ? botConfig.capabilities.join(", ") : "N/A"}
Approved Pricing: ${botConfig.approvedPricing?.length ? JSON.stringify(botConfig.approvedPricing) : "Unlisted"}
${categorySpecificFlow ? `\n${categorySpecificFlow}\n` : ""}

FLUID CONVERSATIONAL RULES (CRITICAL):
1. OUT-OF-BOUNDS GUARDRAIL (STRICT): You are the AI Front Desk for this company. Politely refuse unrelated topics and steer back to how you can help with their property or service needs.
2. CUSTOMER COMES FIRST: Answer questions thoroughly before requesting lead details.
3. CONTEXTUAL NEXT STEP & CTA (CRITICAL):
   - Ask if they would like to **book a service/consultation** OR **request a callback** ONLY when it naturally fits the conversation. 
   - DO NOT repeat this offer on every single turn.
   - ONLY supply actionable shortcuts in "suggested_shortcuts" (e.g., ["Book a Tech", "Request a Callback"]) IF you are actively offering them. Otherwise, leave the array empty [].
4. MEETING BOOKING & CALLBACK CAPTURE (UPDATED):
   - **To book a meeting/demo/service:** You ONLY need to capture Name and Email. DO NOT ask the user for a preferred date or time! Tell the user: "I just need your name and email, and I'll bring up the calendar for you!" Once Name and Email are captured, set "next_action" to "SCHEDULE_CONSULTATION".
   - **For a callback request:** Capture Name, Email, and Preferred time to call. Set "next_action" to "REQUEST_CALLBACK" and add "TRIGGER_CALLBACK" to "flags".
   - IMPORTANT: Ask for their Phone Number as strictly OPTIONAL in both cases. Do not block the process if they skip the phone number.
   - Immediately provide a clear confirmation message confirming their details.
5. HANDOFF & ESCALATION: If user requests a live human, trigger immediately.
6. PRICING: Provide unnegotiated Approved Pricing directly.`;

  if (mode === "text") {
    instructions += `\n\nCURRENTLY COLLECTED DATA:\n${JSON.stringify(currentLeadData || {})}`;
    instructions += `\n\n17. LENGTH CONSTRAINT: Keep responses under 2 to 3 short sentences.`;
    instructions += `\n\nJSON OUTPUT REQUIREMENT:
Output strictly as a raw JSON object matching this schema. Note that 'business_context' contains standard fields PLUS dynamic industry fields (like hvac_service_type, safety_trigger, etc.) based on the active protocol:
{
  "reply": "Your conversational response confirming or offering next steps...",
  "suggested_shortcuts": ["Book a Tech", "Request a Callback"],
  "context_patch": { 
    "contact_info": { "name": null, "email": null, "phone": null }, 
    "business_context": { 
      "industry": null, 
      "business_problem": null, 
      "website": null,
      "hvac_service_type": null,
      "system_type": null,
      "system_status": null,
      "safety_trigger": null,
      "property_type": null,
      "customer_goal": null
    },
    "booking_request": {
      "request_type": "consultation | callback | none",
      "preferred_date": "string | null",
      "preferred_time": "string | null"
    }
  },
  "privacy_patch": [],
  "intent_object": [],
  "lead_temperature": "HIGH | MEDIUM | EDUCATIONAL_LOW_INTENT | UNKNOWN",
  "lead_temperature_reason": null,
  "urgency_level": "High | Medium | Low | Emergency", 
  "flags": ["TRIGGER_CALLBACK", "TRIGGER_DATA_DELETION"],
  "analytics_events": [],
  "state": "string",
  "next_action": "SCHEDULE_CONSULTATION | REQUEST_CALLBACK | NONE",
  "factual_summary": null
}`;
  } else if (mode === "voice") {
    instructions += `\n\n17. VOICE PACING, BREVITY & STT ACCURACY (CRITICAL):
- NO GREETING LOOPS: Never repeat greetings like "Welcome back" or "Hi again" during an active session.
- IGNORE FILLERS & NOISE: Ignore "yeah", "ok", or empty noise. Remain silent.
- PROGRESSIVE CAPTURE & PRIVACY: If a user refuses to provide a piece of information, accept it gracefully. Use 'record_privacy_preference' to log it. Offer an alternative path in a short spoken response.
- CONCISE TURNS: Default to 1-3 short sentences maximum per turn. Never monologue. Maximum ONE question per turn.
- CHUNK LONG EXPLANATIONS: Speak a short introductory part and explicitly ask whether the user wants to hear more.
- STT CONFIRMATION PROTOCOL: You MUST explicitly verbally confirm Emails, Phone Numbers, Website URLs, and ZIP codes/Addresses before saving them.`;
  }

  return { instructions, botConfig };
}