import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

const connectionEl = document.querySelector("#connection-status");
const healthEl = document.querySelector("#health-result");
const realtimeEl = document.querySelector("#realtime-status");
const eventsEl = document.querySelector("#realtime-events");
const testButton = document.querySelector("#test-connection");
const configHelpEl = document.querySelector("#config-help");

let supabaseClient = null;
let realtimeChannel = null;

function setStatus(element, text, state = "neutral") {
  element.textContent = text;
  element.dataset.state = state;
}

function appendEvent(payload) {
  const eventType = payload.eventType || "EVENT";
  const table = payload.table || "unknown";
  const at = new Date().toLocaleTimeString();
  const row = document.createElement("li");
  row.textContent = `${at} — ${table} — ${eventType}`;
  eventsEl.prepend(row);
  while (eventsEl.children.length > 20) {
    eventsEl.removeChild(eventsEl.lastElementChild);
  }
}

function configurationIsReady() {
  return SUPABASE_URL.startsWith("https://")
    && !SUPABASE_URL.includes("YOUR_PROJECT_REF")
    && SUPABASE_PUBLISHABLE_KEY.length > 20
    && !SUPABASE_PUBLISHABLE_KEY.includes("REPLACE_WITH_YOUR_KEY");
}

async function testHealth() {
  setStatus(connectionEl, "กำลังทดสอบ...", "pending");
  setStatus(healthEl, "กำลังเรียก Edge Function...", "pending");

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/health`, {
      method: "GET",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
      },
      cache: "no-store",
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok !== true) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }

    setStatus(connectionEl, "เชื่อมต่อ Supabase ได้", "success");
    healthEl.textContent = JSON.stringify(result, null, 2);
    healthEl.dataset.state = "success";
  } catch (error) {
    setStatus(connectionEl, "เชื่อมต่อไม่สำเร็จ", "error");
    healthEl.textContent = error instanceof Error ? error.message : String(error);
    healthEl.dataset.state = "error";
  }
}

function connectRealtime() {
  if (!supabaseClient) return;
  if (realtimeChannel) {
    supabaseClient.removeChannel(realtimeChannel);
  }

  setStatus(realtimeEl, "กำลังเชื่อมต่อ Realtime...", "pending");
  realtimeChannel = supabaseClient
    .channel("phase1-foundation-room")
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "songs",
    }, (payload) => appendEvent({ ...payload, table: "songs" }))
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "player_public_state",
    }, (payload) => appendEvent({ ...payload, table: "player_public_state" }))
    .subscribe((status, err) => {
      if (status === "SUBSCRIBED") {
        setStatus(realtimeEl, "Realtime เชื่อมต่อแล้ว — รอรับ INSERT / UPDATE", "success");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setStatus(realtimeEl, `Realtime ผิดพลาด: ${err?.message || status}`, "error");
      } else if (status === "CLOSED") {
        setStatus(realtimeEl, "Realtime ถูกปิดการเชื่อมต่อ", "error");
      } else {
        setStatus(realtimeEl, `Realtime: ${status}`, "pending");
      }
    });
}

if (!configurationIsReady()) {
  setStatus(connectionEl, "ยังไม่ได้ตั้งค่า Supabase", "error");
  setStatus(realtimeEl, "รอการตั้งค่า", "neutral");
  configHelpEl.hidden = false;
  testButton.disabled = true;
} else {
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    realtime: { params: { eventsPerSecond: 5 } },
  });
  testButton.addEventListener("click", testHealth);
  testHealth();
  connectRealtime();
}
