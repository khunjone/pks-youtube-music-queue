# คู่มือ Phase 1 — ตั้งค่าระบบพื้นฐาน

เอกสารนี้อธิบายการสร้าง Supabase Project, ฐานข้อมูล, Edge Function และ GitHub Pages เพื่อทดสอบการเชื่อมต่อก่อนเริ่มทำระบบเพลงจริง

## สิ่งที่ต้องเตรียม

1. บัญชี Supabase
2. บัญชี GitHub
3. คอมพิวเตอร์ที่ใช้เว็บเบราว์เซอร์
4. ไฟล์ ZIP ชุด `youtube-music-queue-phase1`

ใน Phase 1 ยังไม่ต้องใช้ YouTube API Key และยังไม่ต้องติดตั้ง Node.js หรือ Supabase CLI หากใช้วิธีสร้าง Edge Function ผ่าน Dashboard ตามคู่มือนี้

---

## ขั้นที่ 1 — สร้าง Supabase Project

1. เปิด https://supabase.com/ แล้วเข้าสู่ระบบ
2. กด **New project**
3. เลือก Organization ที่จะเป็นเจ้าของโปรเจกต์
4. ตั้งชื่อ Project เช่น `youtube-music-queue`
5. ตั้ง Database Password ที่คาดเดายาก แล้วบันทึกไว้ใน Password Manager อย่าส่งรหัสผ่านนี้มาในแชต
6. เลือก Region ที่ใกล้ผู้ใช้งาน เช่น Singapore หากมีให้เลือกในรายการ
7. เลือก Free Plan แล้วกด **Create new project**
8. รอจนสถานะโปรเจกต์พร้อมใช้งาน

**ต้องจดไว้ 2 ค่า**

- Project URL เช่น `https://abcdefghijk.supabase.co`
- Project Reference ซึ่งมองเห็นได้จาก URL ของ Dashboard: `/project/PROJECT_REF`

วิธีดู URL และ Publishable Key: ไปที่ **Project Dashboard → Connect** หรือ **Settings → API Keys** แล้วคัดลอก Project URL และ Publishable Key (ชื่อเดิมอาจแสดงว่า `anon` ในโปรเจกต์/การตั้งค่าแบบเก่า)

ห้ามคัดลอก Secret Key หรือ `service_role` ไปใส่หน้าเว็บ

---

## ขั้นที่ 2 — สร้างตารางด้วย SQL Editor

1. เปิดโปรเจกต์ใน Supabase Dashboard
2. เลือก **SQL Editor** จากเมนูด้านซ้าย
3. กด **New query**
4. เปิดไฟล์ `supabase/migrations/202610300001_initial_schema.sql` จากชุด ZIP
5. คัดลอกเนื้อหาทั้งหมดไปวางใน SQL Editor
6. กด **Run**
7. ตรวจสอบข้อความสำเร็จ หากมี error ให้หยุดก่อน อย่ารันซ้ำหลายครั้งโดยไม่ตรวจสอบข้อความ error

หลังสำเร็จให้ไปที่ **Table Editor** ควรเห็นตารางหลัก เช่น `rooms`, `songs`, `votes`, `player_public_state`, `player_leases` และตารางอื่น ๆ

ในตาราง `rooms` ควรมีห้องชื่อ `Music Room` และ slug `one` หนึ่งแถว รวมถึงมีค่าเริ่มต้นใน `room_settings` และ `player_public_state`

### ทำไมต้องใช้ SQL Editor?

SQL เป็นคำสั่งโดยตรงสำหรับสร้างตาราง ความสัมพันธ์ ดัชนี และนโยบายความปลอดภัย ช่วยให้ตั้งค่าซ้ำได้และเก็บเป็น Migration ใน GitHub เพื่อให้ตรวจสอบการเปลี่ยนแปลงได้

---

## ขั้นที่ 3 — เปิด Realtime สำหรับตารางที่ต้องแจ้งการเปลี่ยนแปลง

ไฟล์ Migration ได้เพิ่ม `songs` และ `player_public_state` เข้า `supabase_realtime` publication แล้ว

ตรวจสอบได้ที่ **Database → Publications** (ชื่อเมนูอาจเปลี่ยนตามหน้าตา Dashboard) แล้วเปิด `supabase_realtime` ควรเห็น 2 ตารางนี้

ถ้าไม่มี ให้กลับไปตรวจผล SQL Migration ก่อน อย่าสร้าง Publication ใหม่ทับของเดิม

---

## ขั้นที่ 4 — สร้าง Edge Function `health`

วิธีที่ง่ายที่สุดสำหรับผู้เริ่มต้นคือใช้ Dashboard Editor

1. เปิดเมนู **Edge Functions**
2. กด **Deploy a new function**
3. เลือก **Via Editor** หรือ **Create function**
4. ตั้งชื่อ Function เป็น `health`
5. เปิดไฟล์ `supabase/functions/health/index.ts` ในชุด ZIP
6. คัดลอกโค้ดทั้งหมดไปแทนโค้ดตัวอย่างใน Editor
7. Deploy Function
8. เปิดหน้า Function รายละเอียด แล้วตรวจสอบว่า JWT Verification ปิดอยู่สำหรับ `health` เท่านั้น เพราะเป็น Health Check สาธารณะที่ไม่รับหรือคืนข้อมูลส่วนตัว

หากใช้ Supabase CLI แทน Dashboard ต้องมี Node.js 20+ และติดตั้ง CLI ตามเอกสารทางการ จากโฟลเดอร์โปรเจกต์ให้ใช้:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy health
```

ไฟล์ `supabase/config.toml` ในชุดนี้ตั้ง `verify_jwt = false` สำหรับ `health` ไว้แล้ว

**URL ของ Function** จะมีรูปแบบ:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/health
```

ลองเปิด URL ในเบราว์เซอร์ได้ ควรได้ JSON ลักษณะนี้:

```json
{
  "ok": true,
  "service": "youtube-music-queue",
  "phase": "foundation",
  "timestamp": "..."
}
```

---

## ขั้นที่ 5 — ตั้งค่า GitHub Repository

1. เปิด https://github.com/ แล้วเข้าสู่ระบบ
2. กดปุ่ม **New repository**
3. ตั้งชื่อ เช่น `youtube-music-queue`
4. เลือก **Public** หากใช้ GitHub Free สำหรับ GitHub Pages
5. กด **Create repository**
6. แตกไฟล์ ZIP ลงในเครื่อง
7. อัปโหลดไฟล์และโฟลเดอร์ทั้งหมดในชุดขึ้น Repository โดยให้ `index.html` อยู่ที่ Root ของ Repository

โครงสร้างที่ควรเห็นใน Repository:

```text
index.html
assets/
supabase/
docs/
README_TH.md
```

อย่าอัปโหลดไฟล์ที่มี Secret, Database Password หรือ Service Role Key

---

## ขั้นที่ 6 — เปิดใช้งาน GitHub Pages

1. ใน Repository เปิด **Settings**
2. เลือก **Pages** จากเมนูด้านซ้าย
3. ในหัวข้อ Build and deployment เลือก **Deploy from a branch**
4. เลือก Branch `main`
5. เลือก Folder `/ (root)`
6. กด **Save**
7. รอ GitHub สร้างเว็บไซต์ แล้วเปิด URL ที่แสดงในหน้า Pages

เว็บไซต์จะมีรูปแบบ `https://YOUR_GITHUB_USERNAME.github.io/youtube-music-queue/`

GitHub Pages เป็นเว็บไซต์สาธารณะ อย่าใส่ข้อมูลลับใน Repository

---

## ขั้นที่ 7 — เชื่อมหน้าเว็บกับ Supabase

1. เปิดไฟล์ `assets/config.js` ใน Repository
2. แก้ `SUPABASE_URL` ให้เป็น Project URL จริง
3. แก้ `SUPABASE_PUBLISHABLE_KEY` ให้เป็น Publishable Key ของโปรเจกต์
4. บันทึกและ Commit การเปลี่ยนแปลง
5. รอ GitHub Pages Deploy เวอร์ชันใหม่
6. เปิดเว็บไซต์ใหม่แล้วกด **ทดสอบการเชื่อมต่อ**

ตัวอย่างรูปแบบค่า (ใช้ค่าจริงของตัวเอง อย่าใช้ตัวอย่างนี้):

```js
export const SUPABASE_URL = "https://YOUR_PROJECT_REF.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_YOUR_PUBLIC_KEY";
```

Publishable Key ออกแบบมาให้ใช้ใน Client ได้ แต่ต้องทำงานร่วมกับ RLS เสมอ ส่วน Secret Key ห้ามใส่ในไฟล์นี้

---

## ขั้นที่ 8 — ทดสอบ Realtime

1. เปิดหน้าเว็บไซต์จาก GitHub Pages ใน Browser หนึ่งหน้าต่าง
2. ในหน้าเว็บควรเห็นสถานะ Edge Function และ Realtime
3. เปิด Supabase Dashboard อีกแท็บหนึ่ง → **SQL Editor**
4. รัน SQL ต่อไปนี้เพื่อเพิ่มรายการทดสอบ (ไม่ต้องเพิ่มซ้ำหากมีรายการเดียวกันอยู่แล้ว)

```sql
INSERT INTO public.songs (
  room_id,
  video_id,
  title,
  channel_title,
  submitted_by,
  status
)
SELECT
  id,
  'phase1-realtime-test',
  'Phase 1 Realtime Test',
  'System Test',
  'Phase 1 Tester',
  'WAITING'
FROM public.rooms
WHERE slug = 'one'
ON CONFLICT DO NOTHING;
```

5. กลับไปหน้า GitHub Pages ควรเห็นรายการ `songs` เปลี่ยนเป็น INSERT Event ในกล่อง Realtime Events
6. ทดลอง UPDATE ด้วย SQL:

```sql
UPDATE public.songs
SET vote_count = vote_count + 1
WHERE video_id = 'phase1-realtime-test';
```

7. หน้าเว็บควรได้รับ UPDATE Event
8. เมื่อตรวจสอบเสร็จ ลบรายการทดสอบ:

```sql
DELETE FROM public.songs
WHERE video_id = 'phase1-realtime-test';
```

การทดสอบนี้ยืนยันว่า Browser รับการเปลี่ยนแปลงจากฐานข้อมูลได้ แต่ยังไม่ใช่ระบบโหวตจริง

---

## เกณฑ์ผ่าน Phase 1

- [ ] สร้าง Supabase Project สำเร็จ
- [ ] รัน SQL Migration สำเร็จ
- [ ] เห็นตารางทั้ง 11 ตารางใน Table Editor
- [ ] ห้อง `one` ถูกสร้างอัตโนมัติ
- [ ] Deploy `health` Function สำเร็จและตอบ `ok: true`
- [ ] GitHub Pages เปิดเว็บไซต์ได้ผ่าน HTTPS
- [ ] หน้าเว็บแสดงสถานะ Connected
- [ ] หน้าเว็บได้รับ Realtime INSERT และ UPDATE
- [ ] ไม่มี Secret Key หรือ Database Password ใน GitHub

## หากพบปัญหา

**Function ตอบ 401**
- ตรวจว่า `health` มี `verify_jwt = false`
- ตรวจว่าตั้งค่า Function เป็น Public ตามขั้นตอน
- อย่าแก้โดยปิด JWT Verification ให้ทุก Function ในอนาคต

**หน้าเว็บขึ้น Missing configuration**
- ตรวจ `assets/config.js`
- ตรวจว่าใช้ Project URL และ Publishable Key ของโปรเจกต์เดียวกัน
- ตรวจว่า Commit/Deploy แล้ว

**Health ผ่าน แต่ Realtime ไม่ขึ้น**
- ตรวจว่า Migration สำเร็จ
- ตรวจว่า `songs` และ `player_public_state` อยู่ใน `supabase_realtime` publication
- ตรวจ RLS policy และ SELECT grants ตาม Migration
- ดู Console ใน Browser เพื่ออ่านข้อความ error

**CORS error**
- ตรวจว่าเรียก URL `https://...supabase.co/functions/v1/health` ถูกต้อง
- อย่าตัด CORS headers ออกจาก Function
- เปิดเว็บผ่าน GitHub Pages หรือ localhost server ไม่ใช่เปิดไฟล์ `index.html` ด้วย `file://`

---

## ขั้นต่อไปหลัง Phase 1 ผ่าน

Phase 2 จะพัฒนา Session จริงและ API `addToQueue` / `getQueue` โดยตรวจ Session Token ที่ Backend, ป้องกันเพลงซ้ำ และให้ Supabase Realtime อัปเดตคิว ก่อนเพิ่มระบบ YouTube Search และ Voting
