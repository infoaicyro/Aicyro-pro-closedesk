// src/Closedesk/Dashboard/superadmin/ClientManagement.jsx
"use client";

import React, { useState, useEffect } from "react";
import { ref, get, set, update } from "firebase/database";
import { db } from "../../../lib/firebase";
import { Check, CircleCheck, Lock, Plus, TriangleAlert, X } from "lucide-react";

// 🔥 TICKET 14
import { createPulseLogger } from "../../../lib/loggerPresets";
import { recordAuditTrail } from "../../../lib/auditTracer";
const pulseLogger = createPulseLogger("ClientManagement");

const INDUSTRY_OPTIONS = [
  { label: "HVAC (Heating & Air)", value: "HVAC", pack: "hvac_v2" },
  { label: "Plumbing Services", value: "Plumbing", pack: "plumbing_v2" },
  { label: "Water & Fire Restoration", value: "Restoration", pack: "restoration_v2" },
  { label: "Roofing & Storm Repair", value: "Roofing", pack: "roofing_v2" },
  { label: "Electrical Contracting", value: "Electrical", pack: "electrical_v2" },
  { label: "Pest Control", value: "Pest Control", pack: "pest_v2" },
  { label: "General Home Services", value: "General", pack: "general_v2" },
];

const INITIAL_NEW_CLIENT = {
  businessName: "",
  tenantId: "",
  industry: "HVAC",
  industryPack: "hvac_v2",
  email: "",
  phone: "",
  timezone: "America/New_York",
  website: "",
  adminUsername: "",
  adminPassword: "",
  allowedOrigin: "*",
  primaryColor: "#0284c7",
};

export default function ClientManagement() {
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // --- MODAL STATES ---
  const [viewingProfile, setViewingProfile] = useState(null);
  const [managingUsers, setManagingUsers] = useState(null);

  // --- ADD CLIENT STATES ---
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [newClientData, setNewClientData] = useState(INITIAL_NEW_CLIENT);
  const [addClientError, setAddClientError] = useState("");
  const [createdClientModal, setCreatedClientModal] = useState(null);
  const [copySuccess, setCopySuccess] = useState("");

  // --- PIN VERIFICATION STATES ---
  const [pinModal, setPinModal] = useState({
    isOpen: false,
    action: null,
    error: "",
  });
  const [pinInput, setPinInput] = useState("");

  // --- PROFILE EDIT STATES ---
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedProfileData, setEditedProfileData] = useState({});

  // --- USER EDIT STATES ---
  const [editingUser, setEditingUser] = useState(null); // { clientIndex, userIndex, name, password }
  const [newPassword, setNewPassword] = useState("");
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", password: "" });
  const [revealedPasswords, setRevealedPasswords] = useState(new Set());

  // --- FETCH CLIENTS (PRIMARY + MULTI-TENANT) ---
  const fetchClientData = async () => {
    try {
      const settingsRef = ref(db, "settings/business_profile");
      const settingsSnap = await get(settingsRef);

      const loginRef = ref(db, "login");
      const loginSnap = await get(loginRef);

      let profileData = {};
      if (settingsSnap.exists()) {
        const rawProfile = settingsSnap.val();
        profileData = {
          ...rawProfile.basic_info,
          timezone: rawProfile.timezone,
          updated_at: rawProfile.updated_at,
        };
      }

      let usersData = [];
      if (loginSnap.exists()) {
        usersData = loginSnap.val().filter((u) => u !== null);
      }

      const loadedClients = [
        {
          id: "primary_client",
          profile: profileData,
          users: usersData,
          isPrimary: true,
        },
      ];

      // Fetch dynamic multi-tenant partitions
      try {
        const tenantsRef = ref(db, "tenants");
        const tenantsSnap = await get(tenantsRef);
        if (tenantsSnap.exists()) {
          const tenantsVal = tenantsSnap.val();
          for (const [tId, tData] of Object.entries(tenantsVal)) {
            if (!tData || tId === "primary_client") continue;
            const tProfile = tData.business_profile?.basic_info || {};
            const tUsers = tData.users
              ? Object.values(tData.users).filter(Boolean)
              : [];
            loadedClients.push({
              id: tId,
              profile: {
                businessName:
                  tProfile.businessName || tData.config?.business_name || tId,
                email: tProfile.email || "",
                phone: tProfile.phone || "",
                website: tProfile.website || "",
                industry:
                  tProfile.industry || tData.config?.industry_pack || "General",
                timezone:
                  tData.business_profile?.timezone ||
                  tData.config?.timezone ||
                  "America/New_York",
                updated_at:
                  tData.business_profile?.updated_at ||
                  tData.created_at ||
                  new Date().toISOString(),
              },
              users: tUsers,
              config: tData.config || {},
              isMultiTenant: true,
            });
          }
        }
      } catch (tenantErr) {
        console.warn("Could not fetch multi-tenant list:", tenantErr);
      }

      setClients(loadedClients);
    } catch (error) {
      console.error("Error fetching client data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClientData();
  }, []);

  // --- PIN AUTH ---
  const requestPinAuth = (actionPayload) => {
    setPinModal({ isOpen: true, action: actionPayload, error: "" });
    setPinInput("");
  };

  const verifyPin = async (pinToVerify) => {
    setActionLoading(true);
    try {
      const currentAdminName = localStorage.getItem("currentSuperAdmin") || "admin";
      const token = localStorage.getItem("cd_session_token");
      const response = await fetch("/api/superadmin/verify-pin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-requested-with": "XMLHttpRequest",
          ...(token ? { "x-cd-session": token } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          username: currentAdminName,
          pin: pinToVerify,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        if (data.token) {
          localStorage.setItem("cd_session_token", data.token);
        }
        executeSecuredAction(pinModal.action);
        setPinModal({ isOpen: false, action: null, error: "" });
        setPinInput("");
      } else {
        setPinModal((prev) => ({
          ...prev,
          error: data.error || "Invalid Secondary Verification PIN or Code. Access denied.",
        }));
        setPinInput("");
      }
    } catch (error) {
      console.error("PIN check error:", error);
      setPinModal((prev) => ({
        ...prev,
        error: "Network error checking verification PIN.",
      }));
      setPinInput("");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePinChange = (e) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
    setPinInput(val);
    if (val.length === 4 || val.length === 6) {
      verifyPin(val);
    }
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinInput.length >= 4) {
      verifyPin(pinInput);
    }
  };

  const executeSecuredAction = (action) => {
    if (!action) return;
    switch (action.type) {
      case "REVEAL_PASSWORD":
        setRevealedPasswords((prev) => {
          const newSet = new Set(prev);
          newSet.add(action.userIndex);
          return newSet;
        });
        break;
      case "EDIT_PASSWORD":
        setEditingUser(action.payload);
        break;
      case "EDIT_PROFILE":
        setIsEditingProfile(true);
        setEditedProfileData({ ...viewingProfile.profile });
        break;
      case "CREATE_CLIENT":
        if (action.payload) {
          performCreateClient(action.payload);
        }
        break;
      default:
        break;
    }
  };

  // --- USER PERSISTENCE (SCOPED PER CLIENT) ---
  const saveUsersToFirebase = async (client, updatedUsersArray) => {
    try {
      setActionLoading(true);
      const token = localStorage.getItem("cd_session_token");
      const res = await fetch("/api/superadmin/tenants", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-requested-with": "XMLHttpRequest",
          ...(token ? { "x-cd-session": token } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          tenantId: client ? client.id : "primary_client",
          userUpdates: updatedUsersArray,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update users");
      }
    } catch (error) {
      console.error("Error saving users:", error);
      alert("Failed to save changes to the database: " + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSavePassword = async () => {
    if (!newPassword.trim()) return;
    const updatedClients = [...clients];
    const targetClient = updatedClients[editingUser.clientIndex];
    const targetUsers = targetClient.users;
    targetUsers[editingUser.userIndex].password = newPassword;

    await saveUsersToFirebase(targetClient, targetUsers);

    recordAuditTrail(pulseLogger, "user_role_changed", {
      who: localStorage.getItem("currentSuperAdmin") || "superadmin",
      target: `client_${targetClient.id}_user_${editingUser.userIndex}`,
      status: "success",
      reason: "Password updated",
    });

    setClients(updatedClients);
    setEditingUser(null);
    setNewPassword("");
  };

  const handleAddUser = async (clientIndex) => {
    if (!newUser.name.trim() || !newUser.password.trim()) return;
    const updatedClients = [...clients];
    const targetClient = updatedClients[clientIndex];
    const targetUsers = targetClient.users;
    targetUsers.push({ ...newUser, role: "admin" });

    await saveUsersToFirebase(targetClient, targetUsers);

    recordAuditTrail(pulseLogger, "client_updated", {
      who: localStorage.getItem("currentSuperAdmin") || "superadmin",
      target: `client_${targetClient.id}`,
      newState: newUser,
      status: "success",
      reason: "New user allocated",
    });

    setClients(updatedClients);
    setNewUser({ name: "", password: "" });
    setIsAddingUser(false);
  };

  const handleDeleteUser = async (clientIndex, userIndex) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    const updatedClients = [...clients];
    const targetClient = updatedClients[clientIndex];
    const targetUsers = targetClient.users;
    const userBeingDeleted = targetUsers[userIndex];

    targetUsers.splice(userIndex, 1);
    await saveUsersToFirebase(targetClient, targetUsers);

    recordAuditTrail(pulseLogger, "user_deleted", {
      who: localStorage.getItem("currentSuperAdmin") || "superadmin",
      target: `client_${targetClient.id}`,
      user: userBeingDeleted?.name,
      status: "success",
    });

    setClients(updatedClients);
  };

  const handleSaveProfile = async () => {
    setActionLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const targetClient = viewingProfile;

      if (!targetClient || targetClient.id === "primary_client") {
        const updates = {
          "settings/business_profile/basic_info/address":
            editedProfileData.address || "",
          "settings/business_profile/basic_info/avgJobValue":
            editedProfileData.avgJobValue || "",
          "settings/business_profile/basic_info/businessName":
            editedProfileData.businessName || "",
          "settings/business_profile/basic_info/email":
            editedProfileData.email || "",
          "settings/business_profile/basic_info/industry":
            editedProfileData.industry || "",
          "settings/business_profile/basic_info/phone":
            editedProfileData.phone || "",
          "settings/business_profile/basic_info/website":
            editedProfileData.website || "",
          "settings/business_profile/timezone":
            editedProfileData.timezone || "America/New_York",
          "settings/business_profile/updated_at": nowIso,
        };
        await update(ref(db), updates);
      } else {
        const tenantUpdates = {
          [`tenants/${targetClient.id}/business_profile/basic_info`]: {
            businessName: editedProfileData.businessName || "",
            email: editedProfileData.email || "",
            phone: editedProfileData.phone || "",
            website: editedProfileData.website || "",
            industry: editedProfileData.industry || "",
            address: editedProfileData.address || "",
          },
          [`tenants/${targetClient.id}/business_profile/timezone`]:
            editedProfileData.timezone || "America/New_York",
          [`tenants/${targetClient.id}/business_profile/updated_at`]: nowIso,
          [`tenants/${targetClient.id}/config/business_name`]:
            editedProfileData.businessName || "",
        };
        await update(ref(db), tenantUpdates);
      }

      recordAuditTrail(pulseLogger, "configuration_changed", {
        who: localStorage.getItem("currentSuperAdmin") || "superadmin",
        target: `tenants/${targetClient.id}/business_profile`,
        previousState: targetClient.profile,
        newState: editedProfileData,
      });

      const updatedClients = clients.map((c) =>
        c.id === targetClient.id
          ? {
              ...c,
              profile: {
                ...editedProfileData,
                updated_at: nowIso,
              },
            }
          : c
      );

      setClients(updatedClients);
      setViewingProfile({
        ...targetClient,
        profile: {
          ...editedProfileData,
          updated_at: nowIso,
        },
      });
      setIsEditingProfile(false);
    } catch (error) {
      console.error("Error saving profile:", error);
      alert("Failed to save profile changes.");
    } finally {
      setActionLoading(false);
    }
  };

  // --- AUTO-SLUGIFY TENANT ID ON NAME CHANGE ---
  const handleBusinessNameChange = (name) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
    setNewClientData((prev) => ({
      ...prev,
      businessName: name,
      tenantId: prev.tenantId && prev.tenantId !== slug ? prev.tenantId : slug,
    }));
  };

  const handleIndustryChange = (industry) => {
    const match = INDUSTRY_OPTIONS.find((opt) => opt.value === industry);
    setNewClientData((prev) => ({
      ...prev,
      industry,
      industryPack: match ? match.pack : "general_v2",
    }));
  };

  // --- CREATE NEW CLIENT HANDLER ---
  const handleCreateNewClient = async (e) => {
    e.preventDefault();
    setAddClientError("");

    const {
      businessName,
      tenantId,
      industry,
      industryPack,
      email,
      phone,
      timezone,
      website,
      adminUsername,
      adminPassword,
      allowedOrigin,
      primaryColor,
    } = newClientData;

    // Validations
    if (!businessName.trim()) {
      setAddClientError("Business Name is required.");
      return;
    }
    if (!tenantId.trim()) {
      setAddClientError("Tenant ID / Identifier is required.");
      return;
    }
    const cleanTenantId = tenantId.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (cleanTenantId !== tenantId) {
      setAddClientError("Tenant ID can only contain lowercase letters, numbers, hyphens, and underscores.");
      return;
    }
    if (clients.some((c) => c.id === cleanTenantId)) {
      setAddClientError(`Tenant ID '${cleanTenantId}' already exists. Please choose a unique identifier.`);
      return;
    }
    if (!adminUsername.trim() || !adminPassword.trim()) {
      setAddClientError("Initial Admin Username and Password are required.");
      return;
    }

    setActionLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const originHost =
        typeof window !== "undefined" ? window.location.origin : "https://app.closedesk.ai";

      const tenantPayload = {
        id: cleanTenantId,
        enabled: true,
        created_at: nowIso,
        business_profile: {
          basic_info: {
            businessName: businessName.trim(),
            email: email.trim(),
            phone: phone.trim(),
            website: website.trim(),
            industry: industry,
          },
          timezone: timezone || "America/New_York",
          updated_at: nowIso,
        },
        config: {
          business_name: businessName.trim(),
          industry_pack: industryPack,
          timezone: timezone || "America/New_York",
          allowed_origins: [allowedOrigin.trim() || "*"],
        },
        chatbot_config: {
          bot_name: `${businessName.trim()} Specialist`,
          voiceEnabled: true,
          voice: "alloy",
          serviceCategory: industry,
        },
        appearance: {
          primaryColor: primaryColor || "#0284c7",
          hue: "blue",
        },
        users: {
          "1": {
            name: adminUsername.trim(),
            username: adminUsername.trim(),
            password: adminPassword.trim(),
            role: "admin",
            created_at: nowIso,
          },
        },
      };

      const clientDataBundle = {
        cleanTenantId,
        tenantPayload,
        businessName,
        email,
        phone,
        website,
        industry,
        timezone,
        adminUsername,
        adminPassword,
        originHost,
        nowIso,
      };

      // Write tenant record securely via server API (CD02)
      const token = localStorage.getItem("cd_session_token");
      const createRes = await fetch("/api/superadmin/tenants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-requested-with": "XMLHttpRequest",
          ...(token ? { "x-cd-session": token } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          tenantId: cleanTenantId,
          tenantPayload,
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        if (createRes.status === 403 && (err.stepUpRequired || (typeof err.error === "string" && err.error.includes("Secondary factor")))) {
          // Trigger PIN verification modal
          requestPinAuth({
            type: "CREATE_CLIENT",
            payload: clientDataBundle,
          });
          return;
        }
        setAddClientError(err.error || "Failed to create tenant");
        return;
      }

      finalizeClientCreation(clientDataBundle);
    } catch (error) {
      console.error("Failed to create client:", error);
      setAddClientError(error.message || "Failed to save new client to Firebase database.");
    } finally {
      setActionLoading(false);
    }
  };

  const performCreateClient = async (clientDataBundle) => {
    setActionLoading(true);
    setAddClientError("");
    try {
      const { cleanTenantId, tenantPayload } = clientDataBundle;
      const token = localStorage.getItem("cd_session_token");
      const createRes = await fetch("/api/superadmin/tenants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-requested-with": "XMLHttpRequest",
          ...(token ? { "x-cd-session": token } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          tenantId: cleanTenantId,
          tenantPayload,
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        setAddClientError(err.error || "Failed to create tenant after PIN verification.");
        return;
      }

      finalizeClientCreation(clientDataBundle);
    } catch (error) {
      console.error("Failed to create client after step-up:", error);
      setAddClientError(error.message || "Failed to save new client to Firebase database.");
    } finally {
      setActionLoading(false);
    }
  };

  const finalizeClientCreation = (clientDataBundle) => {
    const {
      cleanTenantId,
      tenantPayload,
      businessName,
      email,
      phone,
      website,
      industry,
      timezone,
      adminUsername,
      adminPassword,
      originHost,
      nowIso,
    } = clientDataBundle;

    // Record SOC2-style Audit Trail
    recordAuditTrail(pulseLogger, "client_created", {
      who: localStorage.getItem("currentSuperAdmin") || "superadmin",
      target: `tenants/${cleanTenantId}`,
      tenant_id: cleanTenantId,
      industry_pack: tenantPayload.config?.industry_pack,
      status: "success",
    });

    // Update client state locally
    const createdClientObj = {
      id: cleanTenantId,
      profile: {
        businessName: businessName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        website: website.trim(),
        industry: industry,
        timezone: timezone,
        updated_at: nowIso,
      },
      users: [
        {
          name: adminUsername.trim(),
          password: adminPassword.trim(),
          role: "admin",
        },
      ],
      config: tenantPayload.config,
      isMultiTenant: true,
    };

    setClients((prev) => [...prev, createdClientObj]);

    // Open Success & Embed Snippet Modal
    setCreatedClientModal({
      tenantId: cleanTenantId,
      businessName: businessName.trim(),
      adminUsername: adminUsername.trim(),
      adminPassword: adminPassword.trim(),
      embedSnippet: `<script src="${originHost}/widget.js" data-tenant="${cleanTenantId}" defer></script>`,
    });

    // Reset Form
    setNewClientData(INITIAL_NEW_CLIENT);
    setIsAddingClient(false);
  };

  const closeProfileModal = () => {
    setViewingProfile(null);
    setIsEditingProfile(false);
  };

  const closeUsersModal = () => {
    setManagingUsers(null);
    setEditingUser(null);
    setIsAddingUser(false);
    setRevealedPasswords(new Set());
  };

  const copyToClipboard = (text, label) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopySuccess(label);
      setTimeout(() => setCopySuccess(""), 3000);
    }
  };

  if (isLoading) {
    return (
      <div className="cd-page">
        <div className="cd-page__head">
          <div>
            <h1 className="cd-h1">Client Directory</h1>
          </div>
        </div>
        <section className="cd-panel" aria-busy="true">
          <p
            role="status"
            className="flex items-center gap-2 border-b border-rule px-6 py-4 text-ink-2"
          >
            <span className="cd-spinner keep-motion" aria-hidden="true" />
            Syncing client directory with database…
          </p>
          <div className="flex flex-col gap-3 p-6" aria-hidden="true">
            <span className="cd-skel h-9" />
            <span className="cd-skel h-9" />
            <span className="cd-skel h-9" />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="cd-page">
      {/* HEADER SECTION */}
      <div className="cd-page__head">
        <div>
          <h1 className="cd-h1">Client Directory</h1>
          <p className="cd-sub">
            Manage multi-tenant client profiles, staff access, and embed snippets.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setAddClientError("");
            setIsAddingClient(true);
          }}
          className="cd-btn"
        >
          <Plus aria-hidden="true" />
          Add New Client
        </button>
      </div>

      {/* CLIENT TABLE */}
      <section className="cd-panel">
        <div className="cd-table-wrap">
          <table className="cd-table" aria-label="Client Directory">
            <thead>
              <tr>
                <th scope="col">Tenant</th>
                <th scope="col">Status</th>
                <th scope="col">Email</th>
                <th scope="col">Phone</th>
                <th scope="col" className="is-num">Users</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client, cIdx) => (
                <tr key={client.id}>
                  <td>
                    <div className="flex min-w-[13rem] items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-chip bg-paper-2 font-semibold text-ink-2"
                      >
                        {client.profile.businessName
                          ? client.profile.businessName.charAt(0)
                          : "C"}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">
                          {client.profile.businessName || "Unnamed Business"}
                        </p>
                        <p className="flex flex-wrap items-center gap-x-2 text-[length:var(--text-xs)] text-ink-2">
                          <span className="cd-mono">{client.id}</span>
                          <span>{client.profile.industry || "General"}</span>
                        </p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="cd-badge cd-badge--success">Active</span>
                  </td>
                  <td>
                    <div className="max-w-[14rem] truncate" title={client.profile.email || undefined}>
                      {client.profile.email || "—"}
                    </div>
                  </td>
                  <td className="whitespace-nowrap">{client.profile.phone || "—"}</td>
                  <td className="is-num whitespace-nowrap">
                    {client.users.length} {client.users.length === 1 ? "User" : "Users"}
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setViewingProfile(client)}
                        className="cd-btn cd-btn--quiet cd-btn--sm"
                      >
                        View Profile
                      </button>
                      <button
                        type="button"
                        onClick={() => setManagingUsers({ client, cIdx })}
                        className="cd-btn cd-btn--quiet cd-btn--sm"
                      >
                        Manage Users
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ======================================================== */}
      {/* MODAL 1: ADD NEW CLIENT (MULTI-TENANT WIZARD)            */}
      {/* ======================================================== */}
      {isAddingClient && (
        <div className="cd-overlay">
          <div
            className="absolute inset-0"
            aria-hidden="true"
            onClick={() => !actionLoading && setIsAddingClient(false)}
          ></div>
          <div
            className="cd-dialog cd-dialog--wide relative"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cm-add-title"
          >
            <div className="cd-panel__head">
              <div className="min-w-0">
                <h2 id="cm-add-title" className="cd-h2">
                  Provision New Tenant
                </h2>
                <p className="cd-meta mt-1">
                  Create an isolated client partition with customized rules & staff login.
                </p>
              </div>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setIsAddingClient(false)}
                className="cd-icon-btn"
                aria-label="Close"
              >
                <X aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleCreateNewClient}>
              <div className="cd-panel__body flex flex-col gap-6">
                {addClientError && (
                  <div className="cd-alert cd-alert--danger" role="alert">
                    <TriangleAlert aria-hidden="true" />
                    <span>{addClientError}</span>
                  </div>
                )}

                {/* SECTION: BASIC INFO */}
                <section className="flex flex-col gap-3">
                  <h3 className="cd-h3">1. Company & Tenant Identity</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="cd-field">
                      <label className="cd-label" htmlFor="cm-new-business-name">
                        Business Name *
                      </label>
                      <input
                        id="cm-new-business-name"
                        type="text"
                        required
                        placeholder="e.g. Apex Emergency Plumbing"
                        value={newClientData.businessName}
                        onChange={(e) => handleBusinessNameChange(e.target.value)}
                        className="cd-input"
                      />
                    </div>

                    <div className="cd-field">
                      <label className="cd-label" htmlFor="cm-new-tenant-id">
                        Tenant Identifier (Slug) *
                      </label>
                      <input
                        id="cm-new-tenant-id"
                        type="text"
                        required
                        placeholder="e.g. apex_plumbing"
                        value={newClientData.tenantId}
                        onChange={(e) =>
                          setNewClientData({
                            ...newClientData,
                            tenantId: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""),
                          })
                        }
                        className="cd-input font-mono"
                      />
                      <span className="cd-help">
                        Used in{" "}
                        <code className="cd-mono">
                          &lt;script data-tenant=&quot;{newClientData.tenantId || "slug"}&quot;&gt;
                        </code>
                      </span>
                    </div>
                  </div>
                </section>

                {/* SECTION: INDUSTRY & RULES */}
                <section className="flex flex-col gap-3">
                  <h3 className="cd-h3">2. Industry Intelligence Pack</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="cd-field">
                      <label className="cd-label" htmlFor="cm-new-industry">
                        Service Industry *
                      </label>
                      <select
                        id="cm-new-industry"
                        value={newClientData.industry}
                        onChange={(e) => handleIndustryChange(e.target.value)}
                        className="cd-select"
                      >
                        {INDUSTRY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="cd-field">
                      <label className="cd-label" htmlFor="cm-new-pack">
                        Assigned Pack Version
                      </label>
                      <input
                        id="cm-new-pack"
                        type="text"
                        readOnly
                        value={newClientData.industryPack}
                        className="cd-input font-mono"
                      />
                    </div>
                  </div>
                </section>

                {/* SECTION: CONTACT & LOCATION */}
                <section className="flex flex-col gap-3">
                  <h3 className="cd-h3">3. Operational Contact & Timezone</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="cd-field">
                      <label className="cd-label" htmlFor="cm-new-email">
                        Dispatch Email
                      </label>
                      <input
                        id="cm-new-email"
                        type="email"
                        placeholder="dispatch@client.com"
                        value={newClientData.email}
                        onChange={(e) =>
                          setNewClientData({ ...newClientData, email: e.target.value })
                        }
                        className="cd-input"
                      />
                    </div>

                    <div className="cd-field">
                      <label className="cd-label" htmlFor="cm-new-phone">
                        Emergency Phone
                      </label>
                      <input
                        id="cm-new-phone"
                        type="text"
                        placeholder="(555) 000-0000"
                        value={newClientData.phone}
                        onChange={(e) =>
                          setNewClientData({ ...newClientData, phone: e.target.value })
                        }
                        className="cd-input"
                      />
                    </div>

                    <div className="cd-field">
                      <label className="cd-label" htmlFor="cm-new-timezone">
                        Timezone
                      </label>
                      <select
                        id="cm-new-timezone"
                        value={newClientData.timezone}
                        onChange={(e) =>
                          setNewClientData({ ...newClientData, timezone: e.target.value })
                        }
                        className="cd-select"
                      >
                        <option value="America/New_York">Eastern (US)</option>
                        <option value="America/Chicago">Central (US)</option>
                        <option value="America/Denver">Mountain (US)</option>
                        <option value="America/Los_Angeles">Pacific (US)</option>
                        <option value="UTC">UTC Universal</option>
                      </select>
                    </div>
                  </div>
                </section>

                {/* SECTION: ADMIN CREDENTIALS */}
                <section className="flex flex-col gap-3">
                  <h3 className="cd-h3">4. Initial Tenant Admin Credentials</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="cd-field">
                      <label className="cd-label" htmlFor="cm-new-admin-username">
                        Admin Username *
                      </label>
                      <input
                        id="cm-new-admin-username"
                        type="text"
                        required
                        placeholder="e.g. apex_admin"
                        value={newClientData.adminUsername}
                        onChange={(e) =>
                          setNewClientData({ ...newClientData, adminUsername: e.target.value })
                        }
                        className="cd-input"
                      />
                    </div>

                    <div className="cd-field">
                      <label className="cd-label" htmlFor="cm-new-admin-password">
                        Admin Password *
                      </label>
                      <input
                        id="cm-new-admin-password"
                        type="password"
                        required
                        placeholder="••••••••••••"
                        value={newClientData.adminPassword}
                        onChange={(e) =>
                          setNewClientData({ ...newClientData, adminPassword: e.target.value })
                        }
                        className="cd-input"
                      />
                    </div>
                  </div>
                </section>
              </div>

              {/* SUBMIT BUTTONS */}
              <div className="cd-panel__foot">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setIsAddingClient(false)}
                  className="cd-btn cd-btn--quiet"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  aria-busy={actionLoading}
                  className="cd-btn whitespace-nowrap"
                >
                  {actionLoading ? (
                    <>
                      <span className="cd-spinner keep-motion" aria-hidden="true" />
                      Provisioning Tenant in Database…
                    </>
                  ) : (
                    "Create Client Tenant"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: CREATED TENANT SUCCESS & EMBED SNIPPET          */}
      {/* ======================================================== */}
      {createdClientModal && (
        <div className="cd-overlay">
          <div
            className="absolute inset-0"
            aria-hidden="true"
            onClick={() => setCreatedClientModal(null)}
          ></div>
          <div
            className="cd-dialog relative"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cm-created-title"
          >
            <div className="cd-panel__head justify-start">
              <CircleCheck aria-hidden="true" className="h-5 w-5 shrink-0 text-success" />
              <div className="min-w-0">
                <h2 id="cm-created-title" className="cd-h2">
                  Tenant Successfully Created!
                </h2>
                <p className="cd-meta mt-1">
                  {createdClientModal.businessName} is ready to deploy.
                </p>
              </div>
            </div>

            <div className="cd-panel__body flex flex-col gap-5">
              {/* EMBED CODE BOX */}
              <div className="cd-field">
                <div className="flex items-center justify-between gap-3">
                  <p className="cd-label">Website Embed Snippet</p>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(createdClientModal.embedSnippet, "embed")
                    }
                    className="cd-btn cd-btn--ghost cd-btn--sm"
                  >
                    {copySuccess === "embed" ? (
                      <>
                        <Check aria-hidden="true" />
                        Copied!
                      </>
                    ) : (
                      "Copy Code"
                    )}
                  </button>
                </div>
                <div className="cd-well cd-mono select-all break-all text-ink">
                  {createdClientModal.embedSnippet}
                </div>
                <p className="cd-help">
                  Paste this 1-line script tag before the closing &lt;/body&gt; tag on the client&apos;s website (WordPress, Webflow, Shopify, or HTML).
                </p>
              </div>

              {/* CREDENTIALS BOX */}
              <div className="cd-well flex flex-col gap-3">
                <p className="cd-h3">Client Dashboard Login (/lg)</p>
                <dl className="cd-dl">
                  <dt>Username</dt>
                  <dd className="cd-mono">{createdClientModal.adminUsername}</dd>
                  <dt>Password</dt>
                  <dd className="cd-mono">{createdClientModal.adminPassword}</dd>
                </dl>
              </div>
            </div>

            <div className="cd-panel__foot">
              <button
                type="button"
                onClick={() => setCreatedClientModal(null)}
                className="cd-btn cd-btn--block"
              >
                Done & Return to Directory
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: VIEW / EDIT BUSINESS PROFILE                    */}
      {/* ======================================================== */}
      {viewingProfile && (
        <div className="cd-overlay">
          <div
            className="absolute inset-0"
            aria-hidden="true"
            onClick={closeProfileModal}
          ></div>
          <div
            className="cd-dialog cd-dialog--wide relative"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cm-profile-title"
          >
            <div className="cd-panel__head">
              <div className="min-w-0">
                <h2 id="cm-profile-title" className="cd-h2">
                  Business Profile
                </h2>
                <p className="cd-meta cd-mono mt-1">Tenant: {viewingProfile.id}</p>
              </div>
              <div className="flex items-center gap-2">
                {!isEditingProfile && (
                  <button
                    type="button"
                    onClick={() => requestPinAuth({ type: "EDIT_PROFILE" })}
                    className="cd-btn cd-btn--quiet cd-btn--sm"
                  >
                    <Lock aria-hidden="true" />
                    Edit Profile
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeProfileModal}
                  className="cd-icon-btn"
                  aria-label="Close"
                >
                  <X aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="cd-panel__body flex flex-col gap-6">
              {/* Profile Details */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="cd-field">
                  <label className="cd-label" htmlFor="cm-profile-business-name">
                    Business Name
                  </label>
                  {isEditingProfile ? (
                    <input
                      id="cm-profile-business-name"
                      type="text"
                      value={editedProfileData.businessName || ""}
                      onChange={(e) =>
                        setEditedProfileData({
                          ...editedProfileData,
                          businessName: e.target.value,
                        })
                      }
                      className="cd-input"
                    />
                  ) : (
                    <p className="break-words text-ink">
                      {viewingProfile.profile.businessName || "—"}
                    </p>
                  )}
                </div>

                <div className="cd-field">
                  <label className="cd-label" htmlFor="cm-profile-industry">
                    Industry
                  </label>
                  {isEditingProfile ? (
                    <input
                      id="cm-profile-industry"
                      type="text"
                      value={editedProfileData.industry || ""}
                      onChange={(e) =>
                        setEditedProfileData({
                          ...editedProfileData,
                          industry: e.target.value,
                        })
                      }
                      className="cd-input"
                    />
                  ) : (
                    <p className="break-words text-ink">
                      {viewingProfile.profile.industry || "—"}
                    </p>
                  )}
                </div>

                <div className="cd-field">
                  <label className="cd-label" htmlFor="cm-profile-email">
                    Email
                  </label>
                  {isEditingProfile ? (
                    <input
                      id="cm-profile-email"
                      type="email"
                      value={editedProfileData.email || ""}
                      onChange={(e) =>
                        setEditedProfileData({
                          ...editedProfileData,
                          email: e.target.value,
                        })
                      }
                      className="cd-input"
                    />
                  ) : (
                    <p className="break-words text-ink">
                      {viewingProfile.profile.email || "—"}
                    </p>
                  )}
                </div>

                <div className="cd-field">
                  <label className="cd-label" htmlFor="cm-profile-phone">
                    Phone
                  </label>
                  {isEditingProfile ? (
                    <input
                      id="cm-profile-phone"
                      type="text"
                      value={editedProfileData.phone || ""}
                      onChange={(e) =>
                        setEditedProfileData({
                          ...editedProfileData,
                          phone: e.target.value,
                        })
                      }
                      className="cd-input"
                    />
                  ) : (
                    <p className="break-words text-ink">
                      {viewingProfile.profile.phone || "—"}
                    </p>
                  )}
                </div>

                <div className="cd-field">
                  <label className="cd-label" htmlFor="cm-profile-website">
                    Website
                  </label>
                  {isEditingProfile ? (
                    <input
                      id="cm-profile-website"
                      type="text"
                      value={editedProfileData.website || ""}
                      onChange={(e) =>
                        setEditedProfileData({
                          ...editedProfileData,
                          website: e.target.value,
                        })
                      }
                      className="cd-input"
                    />
                  ) : (
                    <p className="break-words text-ink">
                      {viewingProfile.profile.website || "—"}
                    </p>
                  )}
                </div>

                <div className="cd-field">
                  <label className="cd-label" htmlFor="cm-profile-timezone">
                    Timezone
                  </label>
                  {isEditingProfile ? (
                    <input
                      id="cm-profile-timezone"
                      type="text"
                      value={editedProfileData.timezone || ""}
                      onChange={(e) =>
                        setEditedProfileData({
                          ...editedProfileData,
                          timezone: e.target.value,
                        })
                      }
                      className="cd-input"
                    />
                  ) : (
                    <p className="break-words text-ink">
                      {viewingProfile.profile.timezone || "—"}
                    </p>
                  )}
                </div>
              </div>

              {/* Embed snippet view inside profile */}
              <div className="cd-well flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="cd-label">Client Embed Script</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        `<script src="${typeof window !== "undefined" ? window.location.origin : ""}/widget.js" data-tenant="${viewingProfile.id}" defer></script>`,
                        "profile_embed"
                      )
                    }
                    className="cd-btn cd-btn--ghost cd-btn--sm"
                  >
                    {copySuccess === "profile_embed" ? (
                      <>
                        <Check aria-hidden="true" />
                        Copied
                      </>
                    ) : (
                      "Copy"
                    )}
                  </button>
                </div>
                <div className="cd-mono select-all break-all text-ink-2">
                  &lt;script src=&quot;{typeof window !== "undefined" ? window.location.origin : ""}/widget.js&quot; data-tenant=&quot;{viewingProfile.id}&quot; defer&gt;&lt;/script&gt;
                </div>
              </div>
            </div>

            {isEditingProfile && (
              <div className="cd-panel__foot">
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="cd-btn cd-btn--quiet"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  aria-busy={actionLoading}
                  onClick={handleSaveProfile}
                  className="cd-btn"
                >
                  {actionLoading ? "Saving…" : "Save Changes"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: MANAGE TENANT USERS                             */}
      {/* ======================================================== */}
      {managingUsers && (
        <div className="cd-overlay">
          <div
            className="absolute inset-0"
            aria-hidden="true"
            onClick={closeUsersModal}
          ></div>
          <div
            className="cd-dialog cd-dialog--wide relative"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cm-users-title"
          >
            <div className="cd-panel__head">
              <div className="min-w-0">
                <h2 id="cm-users-title" className="cd-h2">
                  Manage Users
                </h2>
                <p className="cd-meta mt-1">
                  Tenant: {managingUsers.client.profile.businessName || managingUsers.client.id}
                </p>
              </div>
              <button
                type="button"
                onClick={closeUsersModal}
                className="cd-icon-btn"
                aria-label="Close"
              >
                <X aria-hidden="true" />
              </button>
            </div>

            <div className="cd-panel__body flex flex-col gap-4">
              <ul className="divide-y divide-rule">
                {managingUsers.client.users.map((user, uIdx) => (
                  <li
                    key={uIdx}
                    className="flex flex-col gap-3 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <h3 className="cd-h3 flex flex-wrap items-center gap-2">
                        {user.name || user.username || "User"}
                        <span className="cd-badge">{user.role || "Admin"}</span>
                      </h3>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="cd-mono text-ink-2">Password:</span>
                        <span className="cd-mono text-ink">
                          {revealedPasswords.has(uIdx) ? user.password : "••••••••"}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            requestPinAuth({
                              type: "REVEAL_PASSWORD",
                              userIndex: uIdx,
                            })
                          }
                          className="cd-link text-[length:var(--text-xs)]"
                        >
                          {revealedPasswords.has(uIdx) ? "" : "Reveal"}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() =>
                          requestPinAuth({
                            type: "EDIT_PASSWORD",
                            payload: {
                              clientIndex: managingUsers.cIdx,
                              userIndex: uIdx,
                              name: user.name || user.username,
                              password: user.password,
                            },
                          })
                        }
                        className="cd-btn cd-btn--quiet cd-btn--sm"
                      >
                        Reset Password
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(managingUsers.cIdx, uIdx)}
                        className="cd-btn cd-btn--danger cd-btn--sm"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Password Edit Box */}
              {editingUser && (
                <section className="flex flex-col gap-3 border-t border-rule pt-4">
                  <h3 className="cd-h3">Reset Password for {editingUser.name}</h3>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="password"
                      placeholder="Enter new password"
                      aria-label="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="cd-input min-w-[12rem] flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setEditingUser(null);
                        setNewPassword("");
                      }}
                      className="cd-btn cd-btn--quiet"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading || !newPassword.trim()}
                      onClick={handleSavePassword}
                      className="cd-btn"
                    >
                      Save
                    </button>
                  </div>
                </section>
              )}

              {/* Add User Box */}
              {isAddingUser ? (
                <section className="flex flex-col gap-3 border-t border-rule pt-4">
                  <h3 className="cd-h3">Allocate New Staff Account</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      placeholder="Username"
                      aria-label="Username"
                      value={newUser.name}
                      onChange={(e) =>
                        setNewUser({ ...newUser, name: e.target.value })
                      }
                      className="cd-input"
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      aria-label="Password"
                      value={newUser.password}
                      onChange={(e) =>
                        setNewUser({ ...newUser, password: e.target.value })
                      }
                      className="cd-input"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingUser(false)}
                      className="cd-btn cd-btn--quiet"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading || !newUser.name.trim() || !newUser.password.trim()}
                      onClick={() => handleAddUser(managingUsers.cIdx)}
                      className="cd-btn"
                    >
                      Add User
                    </button>
                  </div>
                </section>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingUser(true)}
                  className="cd-btn cd-btn--quiet cd-btn--block"
                >
                  <Plus aria-hidden="true" />
                  Allocate New Staff Account
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: PIN SECURITY AUTHORIZATION                      */}
      {/* ======================================================== */}
      {pinModal.isOpen && (
        <div className="cd-overlay">
          <div
            className="absolute inset-0"
            aria-hidden="true"
            onClick={() =>
              setPinModal({ isOpen: false, action: null, error: "" })
            }
          ></div>
          <div
            className="cd-dialog relative max-w-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cm-pin-title"
          >
            <div className="cd-panel__body flex flex-col items-center gap-2 text-center">
              <Lock aria-hidden="true" className="h-6 w-6 text-ink-2" />
              <h2 id="cm-pin-title" className="cd-h2">
                Secondary PIN Verification
              </h2>
              <p className="cd-meta">
                Please enter your Super Admin Secondary Verification PIN or TOTP code to authorize this sensitive action.
              </p>

              <form onSubmit={handlePinSubmit} className="mt-4 flex w-full flex-col gap-2">
                <input
                  type="password"
                  autoFocus
                  maxLength={6}
                  value={pinInput}
                  onChange={handlePinChange}
                  placeholder="••••"
                  aria-label="PIN"
                  aria-invalid={pinModal.error ? "true" : undefined}
                  className="cd-input text-center font-mono text-[length:var(--text-xl)] tracking-[0.5em]"
                />

                {pinModal.error && (
                  <p className="cd-help cd-help--error" role="alert">
                    {pinModal.error}
                  </p>
                )}

                {actionLoading && (
                  <p
                    role="status"
                    className="flex items-center justify-center gap-2 text-[length:var(--text-xs)] text-ink-2"
                  >
                    <span className="cd-spinner keep-motion" aria-hidden="true" />
                    Verifying PIN…
                  </p>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setPinModal({ isOpen: false, action: null, error: "" })
                  }
                  className="cd-btn cd-btn--quiet cd-btn--block mt-4"
                >
                  Cancel
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
