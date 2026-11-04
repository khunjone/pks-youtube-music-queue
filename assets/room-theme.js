import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

const THEMES = {
  BLUE:   { header: "#12243b", primary: "#1d568d", page: "#f3f6fb", border: "#e0e7f0", banner: "#eaf3ff", bannerText: "#1c4268" },
  VIOLET: { header: "#30264a", primary: "#6950a1", page: "#f6f3fb", border: "#e7def3", banner: "#f0eaff", bannerText: "#46366e" },
  ROSE:   { header: "#4a2638", primary: "#a63d67", page: "#fbf3f6", border: "#efdde5", banner: "#fff0f5", bannerText: "#74334e" },
  GREEN:  { header: "#183f39", primary: "#247c6e", page: "#f1f8f6", border: "#d9ece6", banner: "#e8f7f2", bannerText: "#24584e" },
};
const MODE_LABELS = {
  STANDARD: "ห้องเพลงทั่วไป", SCHOOL: "กิจกรรมโรงเรียน",
  PARTY: "งานเลี้ยง / ปาร์ตี้", CELEBRATION: "งานเฉลิมฉลอง",
};

function applyTheme(appearance) {
  const enabled = appearance?.enabled !== false;
  const themeName = enabled && THEMES[appearance?.theme] ? appearance.theme : "BLUE";
  const theme = THEMES[themeName];
  let style = document.getElementById("room-theme-style");
  if (!style) { style = document.createElement("style"); style.id = "room-theme-style"; document.head.append(style); }
  style.textContent = `
    body { background: ${theme.page} !important; }
    header { background: ${theme.header} !important; }
    button:not(.secondary):not(.danger), .linkbtn:not(.secondary) { background: ${theme.primary} !important; }
    .panel, .stat { border-color: ${theme.border} !important; }
    .room-event-banner { margin: 14px auto 0; width: min(1120px, 94vw); padding: 14px 18px; border: 1px solid ${theme.border}; border-left: 5px solid ${theme.primary}; border-radius: 12px; background: ${theme.banner}; color: ${theme.bannerText}; box-shadow: 0 4px 14px #1b31500a; }
    .room-event-banner .room-mode { display: inline-block; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 20px; background: #ffffffb8; margin-bottom: 5px; }
    .room-event-banner h2 { margin: 0 0 4px; font-size: 17px; color: ${theme.bannerText}; }
    .room-event-banner p { margin: 0; font-size: 13px; line-height: 1.55; }
  `;
  const existing = document.getElementById("room-event-banner");
  const show = enabled && appearance?.show_banner !== false && Boolean(appearance?.event_name || appearance?.welcome_title || appearance?.welcome_message);
  if (!show) { existing?.remove(); return; }
  const banner = existing || document.createElement("aside");
  banner.id = "room-event-banner";
  banner.className = "room-event-banner";
  banner.replaceChildren();
  const mode = document.createElement("span"); mode.className = "room-mode";
  mode.textContent = MODE_LABELS[appearance?.mode] || MODE_LABELS.STANDARD;
  const heading = document.createElement("h2");
  heading.textContent = appearance?.event_name || appearance?.welcome_title || "ยินดีต้อนรับ";
  banner.append(mode, heading);
  if (appearance?.welcome_message) {
    const message = document.createElement("p"); message.textContent = appearance.welcome_message; banner.append(message);
  }
  if (!existing) {
    const header = document.querySelector("body > header");
    if (header) header.insertAdjacentElement("afterend", banner);
    else document.body.prepend(banner);
  }
}

export const ROOM_SLUG = (new URLSearchParams(location.search).get("room") || "one").trim().toLowerCase();

export async function refreshRoomTheme() {
  try {
    if (!SUPABASE_URL?.startsWith("https://") || !SUPABASE_PUBLISHABLE_KEY) return;
    const response = await fetch(`${SUPABASE_URL}/functions/v1/music-api`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({ action: "getRoomAppearance", room_slug: ROOM_SLUG }),
    });
    if (!response.ok) return;
    const result = await response.json();
    if (result?.ok) applyTheme(result.appearance || {});
  } catch (error) {
    console.warn("Room appearance could not be loaded:", error);
  }
}

window.refreshRoomTheme = refreshRoomTheme;
refreshRoomTheme();
