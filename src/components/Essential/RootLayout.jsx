// src/components/Essential/RootLayout.jsx (was src/pages/layout.jsx, which also made a public /layout route)
import { useRouter } from "next/router";
import AicyroChatbot from "@/Closedesk/Chatbot/AicyroChatbot";
import { isInternalPath } from "@/lib/routeScopes";

// The marketing site is Aicyro's own (default) tenant.
const SITE_TENANT_ID = "default";

export default function RootLayout({ children }) {
  const router = useRouter();

  // Show the multi-tenant chatbot on public pages only (never on the dashboard,
  // logs, embeds that render their own chatbot, or reports).
  const showChatbot = !isInternalPath(router.pathname);

  return (
    <>
      {children}
      {showChatbot && <AicyroChatbot tenantId={SITE_TENANT_ID} />}
    </>
  );
}
