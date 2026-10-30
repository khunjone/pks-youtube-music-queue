# YouTube Music Queue Manager — Phase 1 Foundation

ชุดเริ่มต้นสำหรับสร้างระบบด้วย GitHub Pages + Supabase PostgreSQL + Edge Functions + Realtime

> ชุดนี้เป็น Foundation สำหรับเชื่อมต่อและทดสอบโครงสร้าง ไม่ใช่ระบบเล่นเพลงฉบับสมบูรณ์ ยังไม่มีฟังก์ชันเพิ่มเพลง/โหวต/Player/Admin สำหรับใช้งานจริง

## สิ่งที่อยู่ในชุดนี้

- `index.html` หน้าเว็บทดสอบการเชื่อมต่อ
- `assets/config.js` จุดตั้งค่า Supabase URL และ Publishable Key
- `assets/app.js` ทดสอบ Edge Function และ Realtime
- `supabase/migrations/202610300001_initial_schema.sql` สร้าง Core Database Schema, RLS, seed ห้องหลัก และ Realtime publication
- `supabase/functions/health/index.ts` Edge Function สำหรับ health check
- `supabase/config.toml` ตั้งค่า function health ให้เป็น public endpoint สำหรับทดสอบ
- `docs/PHASE1_GUIDE_TH.md` คู่มือทำทีละขั้นตอนภาษาไทย

## เริ่มต้นอย่างย่อ

1. สร้าง Supabase Project
2. เปิด SQL Editor แล้วรันไฟล์ migration
3. Deploy Edge Function `health`
4. นำไฟล์ชุดนี้ขึ้น GitHub Repository และเปิด GitHub Pages
5. ใส่ Project URL และ Publishable Key ใน `assets/config.js`
6. เปิดเว็บไซต์ทดสอบ Health Check และ Realtime

อ่านคู่มือฉบับเต็มที่ `docs/PHASE1_GUIDE_TH.md`

## ความปลอดภัย

- ใช้ได้เฉพาะ Supabase Project URL และ Publishable Key ใน Frontend
- ห้ามใส่ Secret Key, Service Role Key, Database Password หรือ YouTube API Key ใน GitHub Pages
- ตารางที่มีข้อมูล Session, Vote, Lease, Admin, Logs และ Request Dedup เปิด RLS และไม่เปิดสิทธิ์ให้ `anon` หรือ `authenticated` อ่าน/เขียนโดยตรง
- เปิดอ่านสาธารณะเฉพาะ `rooms`, `songs` และ `player_public_state` ตามนโยบายที่ระบุใน migration
- Health Function เป็น endpoint สาธารณะและคืนเฉพาะข้อมูลสถานะทั่วไปเท่านั้น

## ข้อจำกัด

- ต้องใส่ค่า Supabase URL และ Publishable Key ก่อนหน้าเว็บเชื่อมต่อได้
- GitHub Pages ต้องใช้ HTTPS ซึ่ง GitHub Pages ให้บริการโดยอัตโนมัติ
- ข้อมูล YouTube ที่ได้จาก API ต้องจัดการตาม YouTube API Services Terms และ Developer Policies
- Free Tier มีโควตาและเงื่อนไขการพักโปรเจกต์ ไม่ใช่บริการไม่จำกัด
