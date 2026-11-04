import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

const $ = (id) => document.getElementById(id);
const notice = (text) => { $("notice").textContent = text || ""; };
const ROOM_SLUG = "one";
const TOKEN_KEY = `ymq_session_token_${ROOM_SLUG}`;
const EXPIRY_KEY = `ymq_session_expiry_${ROOM_SLUG}`;
const ready = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("YOUR_PROJECT_REF") && SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_");
let client, token = localStorage.getItem(TOKEN_KEY) || (ROOM_SLUG === "one" ? localStorage.getItem("ymq_session_token") : ""), channel;
let sessionExpiryTimer = null;
let sessionExpiryValue = "";
const storedExpiry = Number(localStorage.getItem(EXPIRY_KEY) || 0);
if (token && storedExpiry && storedExpiry <= Date.now()) {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRY_KEY);
  if (ROOM_SLUG === "one") localStorage.removeItem("ymq_session_token");
  token = "";
}

if (!ready) {
  $("connection").textContent = "กรุณาตั้งค่า assets/config.js";
  $("start-session").disabled = true;
} else {
  client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  $("connection").textContent = "เชื่อมต่อ Supabase แล้ว";
  if (token) showApp();
}

function clearUserSession(message = "Session ประจำวันหมดอายุ กรุณากรอกชื่อเพื่อเริ่มใช้งานใหม่") {
  if (sessionExpiryTimer) clearTimeout(sessionExpiryTimer);
  sessionExpiryTimer = null;
  sessionExpiryValue = "";
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRY_KEY);
  if (ROOM_SLUG === "one") localStorage.removeItem("ymq_session_token");
  token = "";
  if (channel) { client?.removeChannel(channel); channel = null; }
  $("app-panel").hidden = true;
  $("session-panel").hidden = false;
  $("queue").replaceChildren();
  notice(message);
}

function scheduleSessionExpiry(value) {
  const expiresAt = Date.parse(value || "");
  if (!Number.isFinite(expiresAt)) return;
  if (sessionExpiryValue === value && sessionExpiryTimer) return;
  sessionExpiryValue = value;
  if (sessionExpiryTimer) clearTimeout(sessionExpiryTimer);
  localStorage.setItem(EXPIRY_KEY, String(expiresAt));
  const expire = () => {
    const remaining = expiresAt - Date.now();
    if (remaining > 0) {
      sessionExpiryTimer = setTimeout(expire, Math.min(remaining, 2147483647));
      return;
    }
    clearUserSession();
  };
  expire();
}

async function api(action, data = {}) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/music-api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_PUBLISHABLE_KEY,
      ...(token ? { "x-session-token": token } : {}),
    },
    body: JSON.stringify({ action, room_slug: ROOM_SLUG, ...data }),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    const message = result.error || `HTTP ${response.status}`;
    if (token && /Session หมดอายุ|กรุณาเริ่มใช้งานด้วยชื่อผู้ส่ง/.test(message)) {
      clearUserSession(message);
    }
    throw new Error(message);
  }
  if (result.expires_at) scheduleSessionExpiry(result.expires_at);
  if (result.session_expires_at) scheduleSessionExpiry(result.session_expires_at);
  return result;
}

$("start-session").addEventListener("click", async () => {
  try {
    const name = $("display-name").value.trim();
    const result = await api("createSession", { display_name: name });
    token = result.session_token;
    localStorage.setItem(TOKEN_KEY, token);
    if (ROOM_SLUG === "one") localStorage.setItem("ymq_session_token", token);
    showApp();
    notice(`ยินดีต้อนรับ ${result.display_name}`);
  } catch (e) { notice(e.message); }
});

function showApp() {
  $("session-panel").hidden = true;
  $("app-panel").hidden = false;
  loadQueue();
  if (channel) client.removeChannel(channel);
  // Subscribe only to a minimal room signal. Song/dedication rows remain server-only.
  channel = client.channel(`music-room-live-${ROOM_SLUG}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "queue_signals", filter: `room_slug=eq.${ROOM_SLUG}` }, loadQueue)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "queue_signals", filter: `room_slug=eq.${ROOM_SLUG}` }, loadQueue)
    .subscribe();
}

$("search-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    notice("กำลังค้นหาเพลง…");
    const searchButton = $("search-button");
    if (searchButton) { searchButton.disabled = true; searchButton.textContent = "กำลังค้นหา…"; }
    const { items } = await api("searchSongs", { query: $("query").value });
    $("search-results").replaceChildren();
    if (!items.length) $("search-results").innerHTML = '<div class="empty request-empty">ไม่พบเพลงที่ค้นหา ลองพิมพ์ชื่อเพลงหรือศิลปินอีกครั้ง</div>';
    items.forEach((song) => {
      const row = songElement(song, false);
      const add = document.createElement("button");
      add.textContent = "ฝากเพลงนี้";
      add.setAttribute("aria-label", `ฝากเพลง ${song.title} เข้าคิว`);
      add.addEventListener("click", async () => {
        add.disabled = true;
        try {
          await api("addToQueue", {
            video_id: song.video_id,
            recipient: $("recipient").value.trim(),
            message: $("message").value.trim(),
          });
          notice(`ฝากเพลง “${song.title}” เข้าคิวเรียบร้อยแล้ว`);
          await loadQueue();
        } catch (e) { notice(e.message); add.disabled = false; }
      });
      row.append(add);
      $("search-results").append(row);
    });
    notice(`พบ ${items.length} รายการ`);
  } catch (e) { notice(e.message); }
  finally {
    const searchButton = $("search-button");
    if (searchButton) { searchButton.disabled = false; searchButton.innerHTML = '<span aria-hidden="true">⌕</span> ค้นหาเพลง'; }
  }
});

function songElement(song, queued) {
  const row = document.createElement("article");
  row.className = "song";
  if (song.thumbnail) {
    const img = document.createElement("img");
    img.src = song.thumbnail; img.alt = ""; row.append(img);
  }
  const info = document.createElement("div"); info.className = "song-info";
  const title = document.createElement("div"); title.className = "song-title"; title.textContent = song.title;
  const channelText = document.createElement("div"); channelText.className = "muted"; channelText.textContent = song.channel_title || "";
  info.append(title, channelText);
  if (queued) {
    const detail = document.createElement("div"); detail.className = "dedication";
    detail.textContent = `ผู้ส่ง: ${song.submitted_by || "-"}${song.recipient ? ` · ฝากถึง: ${song.recipient}` : ""}${song.message ? ` · ${song.message}` : ""}`;
    info.append(detail);
  }
  row.append(info);
  return row;
}

async function loadQueue() {
  try {
    const { songs } = await api("getQueue");
    $("queue").replaceChildren();
    if (!songs.length) { $("queue").innerHTML = '<div class="empty request-empty"><strong>ยังไม่มีเพลงในคิว</strong><span>เริ่มค้นหาเพลง แล้วฝากเพลงแรกให้เพื่อน ๆ ฟังได้เลย</span></div>'; return; }
    songs.forEach((song, index) => {
      const row = songElement(song, true);
      const controls = document.createElement("div"); controls.className = "vote";
      const score = document.createElement("span"); score.className = "score"; score.textContent = `${song.vote_count} คะแนน`;
      controls.append(score);
      if (song.status === "WAITING") {
        const button = document.createElement("button");
        button.textContent = song.my_vote ? "ยกเลิกโหวต" : "โหวต";
        button.addEventListener("click", async () => {
          button.disabled = true;
          try {
            await api(song.my_vote ? "cancelVote" : "voteSong", { song_id: song.id });
            await loadQueue();
          } catch (e) { notice(e.message); button.disabled = false; }
        });
        controls.append(button);
      } else {
        const playing = document.createElement("div"); playing.className = "muted"; playing.textContent = "กำลังเล่น";
        controls.append(playing);
      }
      row.append(controls);
      $("queue").append(row);
    });
  } catch (e) { notice(e.message); }
}
