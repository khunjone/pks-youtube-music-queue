import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const youtubeKey = Deno.env.get("YOUTUBE_API_KEY")!;
const db = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function getSession(token: string) {
  if (!token) throw new Error("กรุณาเริ่มใช้งานด้วยชื่อผู้ส่งก่อน");
  const tokenHash = await sha256(token);
  const { data, error } = await db.from("user_sessions")
    .select("id, room_id, display_name, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.revoked_at || new Date(data.expires_at).getTime() <= Date.now()) {
    throw new Error("Session หมดอายุ กรุณาเริ่มใช้งานใหม่");
  }
  await db.from("user_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", data.id);
  return data;
}

async function youtubeSearch(query: string) {
  if (!query || query.trim().length < 2) throw new Error("กรุณาพิมพ์คำค้นหาอย่างน้อย 2 ตัวอักษร");
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.search = new URLSearchParams({
    key: youtubeKey,
    part: "snippet",
    type: "video",
    q: query.trim(),
    maxResults: "10",
    videoEmbeddable: "true",
    videoSyndicated: "true",
    regionCode: "TH",
    relevanceLanguage: "th",
  }).toString();
  const response = await fetch(url);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || "ค้นหา YouTube ไม่สำเร็จ");
  return (result.items || []).map((item: any) => ({
    video_id: item.id.videoId,
    title: item.snippet.title,
    channel_title: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || null,
  }));
}

async function verifyVideo(videoId: string) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw new Error("รหัสวิดีโอไม่ถูกต้อง");
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.search = new URLSearchParams({
    key: youtubeKey, part: "snippet,contentDetails,status", id: videoId,
  }).toString();
  const response = await fetch(url);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || "ตรวจสอบวิดีโอไม่สำเร็จ");
  const item = result.items?.[0];
  if (!item || item.status?.embeddable !== true || item.status?.privacyStatus !== "public") {
    throw new Error("วิดีโอนี้ไม่พร้อมให้เล่นแบบฝัง กรุณาเลือกเพลงอื่น");
  }
  const duration = item.contentDetails?.duration || "";
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  const seconds = match ? Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0) : null;
  return {
    title: item.snippet.title,
    channel_title: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || null,
    duration_seconds: seconds,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "ใช้ POST เท่านั้น" }, 405);

  try {
    const body = await req.json();
    const action = String(body.action || "");
    const token = req.headers.get("x-session-token") || body.session_token || "";

    if (action === "createSession") {
      const displayName = String(body.display_name || "").trim().slice(0, 80);
      if (!displayName) return json({ ok: false, error: "กรุณากรอกชื่อผู้ส่ง" }, 400);
      const { data: room, error: roomError } = await db.from("rooms")
        .select("id").eq("slug", "one").eq("enabled", true).single();
      if (roomError || !room) throw new Error("ไม่พบห้องเพลงหรือห้องถูกปิด");
      const rawToken = newToken();
      const { error } = await db.from("user_sessions").insert({
        room_id: room.id,
        display_name: displayName,
        token_hash: await sha256(rawToken),
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      });
      if (error) throw error;
      return json({ ok: true, session_token: rawToken, display_name: displayName });
    }

    const session = await getSession(token);

    if (action === "searchSongs") {
      const items = await youtubeSearch(String(body.query || ""));
      return json({ ok: true, items });
    }

    if (action === "getQueue") {
      const { data: songs, error } = await db.from("songs")
        .select("id, video_id, title, channel_title, thumbnail, duration_seconds, submitted_by, recipient, message, submitted_at, vote_count, status")
        .eq("room_id", session.room_id)
        .in("status", ["WAITING", "PLAYING"])
        .order("status", { ascending: true })
        .order("vote_count", { ascending: false })
        .order("submitted_at", { ascending: true })
        .order("id", { ascending: true });
      if (error) throw error;
      const ids = (songs || []).filter((s: any) => s.status === "WAITING").map((s: any) => s.id);
      let voted = new Set<string>();
      if (ids.length) {
        const { data: votes, error: voteError } = await db.from("votes")
          .select("song_id").eq("voter_session_id", session.id).eq("is_active", true).in("song_id", ids);
        if (voteError) throw voteError;
        voted = new Set((votes || []).map((v: any) => v.song_id));
      }
      return json({ ok: true, songs: (songs || []).map((s: any) => ({ ...s, my_vote: voted.has(s.id) })) });
    }

    if (action === "addToQueue") {
      const videoId = String(body.video_id || "");
      const submitter = String(body.submitted_by || session.display_name).trim().slice(0, 80);
      const recipient = String(body.recipient || "").trim().slice(0, 50) || null;
      const message = String(body.message || "").trim().slice(0, 200) || null;
      if (!submitter) throw new Error("กรุณากรอกชื่อผู้ส่ง");
      const { data: settingsRow, error: settingsError } = await db.from("room_settings")
        .select("settings").eq("room_id", session.room_id).single();
      if (settingsError) throw settingsError;
      const settings = settingsRow.settings || {};
      if (settings.max_queue) {
        const { count } = await db.from("songs").select("id", { count: "exact", head: true })
          .eq("room_id", session.room_id).eq("status", "WAITING");
        if ((count || 0) >= Number(settings.max_queue)) throw new Error("คิวเพลงเต็มแล้ว");
      }
      const { count: ownCount } = await db.from("songs").select("id", { count: "exact", head: true })
        .eq("room_id", session.room_id).eq("status", "WAITING").eq("submitted_by", session.display_name);
      if ((ownCount || 0) >= Number(settings.max_song_per_user || 5)) throw new Error("คุณเพิ่มเพลงครบจำนวนที่กำหนดแล้ว");
      const meta = await verifyVideo(videoId);
      const { data, error } = await db.from("songs").insert({
        room_id: session.room_id, video_id: videoId, ...meta,
        submitted_by: submitter, recipient, message, status: "WAITING",
      }).select("id, title, submitted_at").single();
      if (error?.code === "23505") throw new Error("เพลงนี้อยู่ในคิวแล้ว");
      if (error) throw error;
      return json({ ok: true, song: data });
    }

    if (action === "voteSong" || action === "cancelVote") {
      const songId = String(body.song_id || "");
      const { data: song, error: songError } = await db.from("songs")
        .select("id, status, room_id").eq("id", songId).eq("room_id", session.room_id).maybeSingle();
      if (songError) throw songError;
      if (!song || song.status !== "WAITING") throw new Error("เพลงนี้ไม่อยู่ในสถานะรอโหวต");
      if (action === "voteSong") {
        const { error } = await db.from("votes").insert({ song_id: songId, voter_session_id: session.id, is_active: true });
        if (error?.code === "23505") throw new Error("คุณโหวตเพลงนี้ไปแล้ว");
        if (error) throw error;
      } else {
        const { data: vote, error: findError } = await db.from("votes")
          .select("id").eq("song_id", songId).eq("voter_session_id", session.id).eq("is_active", true).maybeSingle();
        if (findError) throw findError;
        if (!vote) throw new Error("คุณยังไม่ได้โหวตเพลงนี้");
        const { error } = await db.from("votes").update({ is_active: false }).eq("id", vote.id);
        if (error) throw error;
      }
      return json({ ok: true });
    }

    return json({ ok: false, error: "ไม่รู้จัก action นี้" }, 400);
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 400);
  }
});
