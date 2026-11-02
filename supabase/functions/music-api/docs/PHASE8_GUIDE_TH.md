# คู่มือติดตั้ง Phase 8 — Multi-Room

Phase 8 ทำให้ระบบรองรับหลายห้องเพลงใน Supabase Project และ GitHub Repository เดิม แต่ละห้องมีคิว โหวต Player การตั้งค่า ธีม คลังเพลง และรายงานแยกจากกัน

## ก่อนเริ่ม

- ต้องติดตั้งและใช้งาน Phase 1–7 ได้แล้ว
- สำรองไฟล์ GitHub Repository และคัดลอก SQL ปัจจุบันเก็บไว้ก่อน
- ไม่ต้องสร้าง Supabase Project, GitHub Repository หรือ Edge Function ใหม่
- ใช้ `music-api` ตัวเดิม และคง Secret เดิมทั้งหมด

## ติดตั้ง 3 ขั้นตอน

### 1) เพิ่ม RPC สำหรับสร้างห้อง

1. เปิด Supabase Dashboard → SQL Editor → New query
2. เปิดไฟล์ `supabase/migrations/202610310008_multi_room.sql`
3. คัดลอก SQL ทั้งหมดไปวาง แล้วกด Run หนึ่งครั้ง

Migration นี้ไม่สร้างตารางใหม่ แต่สร้างฟังก์ชัน `create_music_room()` สำหรับสร้างห้องพร้อมแถวเริ่มต้นใน `room_settings`, `player_public_state` และ `playlists` ฟังก์ชันอนุญาตให้เรียกได้เฉพาะ `service_role` ผ่าน Backend

> ต้องมีตาราง `playlists` จาก Phase 6 อยู่แล้ว

### 2) อัปเดต Edge Function เดิม

1. เปิด Supabase Dashboard → Edge Functions → `music-api`
2. แทนที่โค้ดเดิมทั้งหมดด้วย `supabase/functions/music-api/index.ts` ในชุด Phase 8
3. กด Deploy updates
4. คง `Verify JWT = OFF` ตามการตั้งค่าของ Phase 2–7 (ระบบตรวจ Supabase Auth หรือ Session Token ภายใน Function อยู่แล้ว)

ไม่ต้องสร้าง Function ใหม่ ไม่ต้องเพิ่ม Secret หรือ API Key

### 3) อัปเดตไฟล์ GitHub Pages

นำไฟล์จาก ZIP ไปวางใน Repository เดิมตามนี้

| ไฟล์ในชุด Phase 8 | การดำเนินการ |
|---|---|
| `rooms.html` | เพิ่มไฟล์ใหม่ที่ Root |
| `index.html` | แทนที่ไฟล์เดิม |
| `admin.html` | แทนที่ไฟล์เดิม |
| `library.html` | แทนที่ไฟล์เดิม |
| `analytics.html` | แทนที่ไฟล์เดิม |
| `player.html` | แทนที่ไฟล์เดิม |
| `assets/app.js` | แทนที่ไฟล์เดิม |
| `assets/room-theme.js` | แทนที่ไฟล์เดิม |

**ห้ามแทนที่หรือลบ** `assets/config.js` และ `assets/style.css` ให้คงไฟล์และค่าจากระบบเดิมไว้ นอกจากนี้คงไฟล์อื่นใน Repository ที่ไม่ได้ระบุไว้ เช่น `supabase/config.toml` และ Migration เดิมทั้งหมด

## วิธีใช้งาน

### เลือกห้อง

เปิดหน้า directory:

`https://ชื่อผู้ใช้.github.io/ชื่อ-repository/rooms.html`

ผู้ใช้จะเห็นเฉพาะห้องที่เปิดใช้งาน และเลือกเข้าหน้าห้องเพลงหรือหน้า Player ได้

### URL ของแต่ละห้อง

ระบบใช้ query parameter `room` เพื่อระบุห้อง โดยค่าเริ่มต้นยังเป็น `one`

- ห้องเดิม: `index.html?room=one`
- ห้องใหม่ตัวอย่าง: `index.html?room=sports-day`
- Admin: `admin.html?room=sports-day`
- Player: `player.html?room=sports-day`
- คลังเพลง: `library.html?room=sports-day`
- Analytics: `analytics.html?room=sports-day`

หน้าเว็บจะส่ง `room_slug` ให้ Backend ทุกครั้งที่จำเป็น และ Backend จะตรวจห้องจากฐานข้อมูล ไม่ใช้ชื่อห้องจากหน้าเว็บเป็นสิทธิ์เข้าถึงข้อมูล

### สร้างห้องใหม่

1. เข้า `admin.html?room=one` แล้วเข้าสู่ระบบด้วยบัญชี ADMIN
2. ในหัวข้อ **จัดการหลายห้องเพลง** กรอกชื่อห้อง
3. กรอก Room Slug ภาษาอังกฤษตัวพิมพ์เล็ก/ตัวเลข/ขีดกลาง เช่น `sports-day`
4. กด **สร้างห้องเพลง**
5. ระบบสร้างค่าตั้งต้นของห้องและเปิดหน้า Admin ของห้องใหม่ให้

ข้อกำหนด Room Slug: 3–40 ตัวอักษร ใช้ `a-z`, `0-9`, `-` ห้ามขึ้นต้นหรือลงท้ายด้วย `-` และต้องไม่ซ้ำกัน ระบบจำกัดสูงสุด 50 ห้อง

### เปิด/ปิดห้อง

ในรายการห้องเพลง ผู้มีสิทธิ์ ADMIN กดปิดหรือเปิดห้องได้ ห้องที่ปิดจะไม่ปรากฏใน directory และผู้ใช้ทั่วไป/Player จะเข้าใช้งานไม่ได้ แต่ข้อมูลเดิมจะยังคงอยู่ ไม่มีการลบคิว ประวัติ Session หรือ Playlist

ห้อง `one` เป็นห้องหลักเพื่อความเข้ากันได้กับระบบเดิม จึงไม่อนุญาตให้ปิดผ่านหน้าจัดการ

## การทดสอบหลังติดตั้ง

1. เปิด `rooms.html` ต้องเห็นห้อง `one` ที่ใช้งานเดิม
2. เข้า `admin.html?room=one` และสร้างห้องทดลอง เช่น `test-room`
3. ตรวจว่าห้องทดลองปรากฏใน `rooms.html`
4. เปิด `index.html?room=test-room` แล้วสร้าง Session และเพิ่มเพลง
5. เปิด `index.html?room=one` ตรวจว่าคิวห้องหลักไม่เปลี่ยนตามเพลงของห้องทดลอง
6. ทดสอบโหวตในแต่ละห้อง ต้องไม่กระทบคะแนนอีกห้อง
7. เปิด Player แยกตาม Room Slug และตรวจว่า Lease/คิวเล่นแยกกัน
8. ตรวจ Favorite, Playlist, เพลงประจำห้อง และ Theme ของแต่ละห้อง
9. เปิด Analytics โดยใช้ `?room=...` ของแต่ละห้อง ตรวจว่ารายงานเป็นข้อมูลเฉพาะห้อง
10. ปิดห้องทดลองจาก Admin ตรวจว่าไม่แสดงใน directory แล้วเปิดกลับ
11. ตรวจว่าห้อง `one` ยังใช้งาน URL เดิมที่ไม่มี `?room=` ได้

## สิทธิ์และข้อจำกัด

- บัญชี ADMIN/MODERATOR ใช้ Supabase Auth เดิมและมีสิทธิ์ข้ามทุกห้องตามบทบาทเดิม (ไม่มีระบบกำหนดผู้ดูแลรายห้องใน Phase นี้)
- Session ของผู้ใช้ทั่วไปผูกกับ Room ID และมี Token Key แยกตาม Room Slug ใน Local Storage เพื่อไม่ให้ Session คนละห้องชนกัน
- Player Device ID แยกตาม Room Slug และ Lease จัดเก็บแยกตาม `room_id`
- ระบบไม่ลบห้องถาวร ใช้การปิดใช้งานเพื่อรักษาประวัติ
- หน้า `rooms.html` เป็น directory สาธารณะ แสดงเฉพาะชื่อและ slug ของห้องที่ enabled
- Phase 8 รองรับสูงสุด 50 ห้องตามการตรวจสอบใน Backend
- ระบบยังใช้ CORS `*` ตามชุดก่อนหน้า ควรจำกัด Origin ให้ตรงกับ GitHub Pages domain ก่อนเปิดใช้สาธารณะในวงกว้าง

## หากพบปัญหา

- `create_music_room` ไม่พบ relation `playlists`: ตรวจว่ารัน Migration Phase 6 แล้ว
- `Function not found`: ตรวจว่า Deploy โค้ด Phase 8 ไปที่ Function ชื่อ `music-api` ตัวเดิม
- `Room Slug ไม่ถูกต้อง`: ใช้ตัวพิมพ์เล็กภาษาอังกฤษ ตัวเลข และขีดกลาง ความยาว 3–40 ตัว
- ห้องไม่ขึ้นใน `rooms.html`: ตรวจ `rooms.enabled` ผ่านหน้า Admin
- Session เดิมไม่ขึ้นในห้องใหม่: เป็นพฤติกรรมปกติ Session แยกตามห้อง ต้องสร้าง Session ในแต่ละห้องครั้งแรก
- หลังเปลี่ยนไฟล์แล้วหน้าเว็บยังเป็นโค้ดเดิม: รีเฟรชแบบไม่ใช้ Cache (Ctrl+F5) และตรวจ GitHub Pages deployment
