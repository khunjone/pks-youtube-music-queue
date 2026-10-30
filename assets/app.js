import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

const $ = (id) => document.getElementById(id);
const notice = (text) => { $("notice").textContent = text || ""; };
const ready = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("YOUR_PROJECT_REF") && SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_");
let client, token = localStorage.getItem("ymq_session_token"), channel;

if (!ready) {
  $("connection").textContent = "กรุณาตั้งค่า assets/config.js";
  $("start-session").disabled = true;
} else {
  client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  $("connection").textContent = "เชื่อมต่อ Supabase แล้ว";
  if (token) showApp();
}

async function api(action, data = {}) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/music-api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_PUBLISHABLE_KEY,
      ...(token ? { "x-session-token": token } : {}),
    },
    body: JSON.stringify({ action, ...data }),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}

$("start-session").addEventListener("click", async () => {
  try {
    const name = $("display-name").value.trim();
    const result = await api("createSession", { display_name: name });
    token = result.session_token;
    localStorage.setItem("ymq_session_token", token);
    showApp();
    notice(`ยินดีต้อนรับ ${result.display_name}`);
  } catch (e) { notice(e.message); }
});

function showApp() {
  $("session-panel").hidden = true;
  $("app-panel").hidden = false;
  loadQueue();
  if (channel) client.removeChannel(channel);
  channel = client.channel("music-room-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "songs" }, loadQueue)
    .subscribe();
}

$("search-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    notice("กำลังค้นหา…");
    const { items } = await api("searchSongs", { query: $("query").value });
    $("search-results").replaceChildren();
    if (!items.length) $("search-results").textContent = "ไม่พบเพลง";
    items.forEach((song) => {
      const row = songElement(song, false);
      const add = document.createElement("button");
      add.textContent = "เพิ่มเพลง";
      add.addEventListener("click", async () => {
        add.disabled = true;
        try {
          await api("addToQueue", {
            video_id: song.video_id,
            recipient: $("recipient").value.trim(),
            message: $("message").value.trim(),
          });
          notice("เพิ่มเพลงเข้าคิวแล้ว");
          await loadQueue();
        } catch (e) { notice(e.message); add.disabled = false; }
      });
      row.append(add);
      $("search-results").append(row);
    });
    notice(`พบ ${items.length} รายการ`);
  } catch (e) { notice(e.message); }
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
    if (!songs.length) { $("queue").textContent = "ยังไม่มีเพลงในคิว"; return; }
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
