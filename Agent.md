# Agent.md — ระบบจัดการกิจกรรมนิสิต TSU

อัปเดตล่าสุด: 13 มิถุนายน 2026

เอกสารนี้เป็นคู่มือสำหรับ AI agent หรือนักพัฒนาที่ต้องเข้ามาทำงานต่อในโปรเจกต์นี้ ให้เริ่มจากไฟล์นี้ก่อนเสมอ เพราะสรุปภาพรวมระบบ โครงสร้างโค้ด จุดสำคัญ และแนวทางตรวจงานล่าสุดไว้แล้ว

---

## ภาพรวมระบบ

**ชื่อระบบ:** ระบบจัดการกิจกรรมนิสิต มหาวิทยาลัยทักษิณ

**วัตถุประสงค์:** จัดการกิจกรรม การลงทะเบียน การตรวจหลักฐาน ชั่วโมงกิจกรรม เกณฑ์กิจกรรม รายงาน และการแจ้งเตือนของนิสิต

**กลุ่มผู้พัฒนา:**

- นายอานนท์ ศรีรัฐ รหัสนิสิต 6720210057
- นายวรพล บัวแก้ว รหัสนิสิต 6720210050
- นายศุภกร ยางสมบูรณ์ รหัสนิสิต 6720210102

ระบบแบ่งผู้ใช้หลักเป็น 2 กลุ่ม:

- `student`: นิสิต ใช้ดูแดชบอร์ด ดูกิจกรรม ลงทะเบียน ยกเลิกลงทะเบียน ยื่นหลักฐาน และติดตามเกณฑ์กิจกรรม
- `staff`: เจ้าหน้าที่ ใช้จัดการกิจกรรม เกณฑ์ ผู้ใช้ หลักฐาน รายงาน ห้อง/สถานที่ และตรวจสอบเวลาระบบ

---

## Tech Stack

| ส่วน | เทคโนโลยี |
|---|---|
| Runtime | Node.js >= 18 |
| Framework | Express 4.x |
| Database | MySQL 8.0 ผ่าน `mysql2/promise` |
| Auth | Google OAuth 2.0 + JWT ใน `httpOnly` cookie |
| Frontend | HTML5 + CSS3 + Vanilla JavaScript |
| Upload | `multer` |
| Performance | `compression`, static cache แบบ revalidate, query version ใน asset |
| Deployment | Docker + Coolify |

---

## โครงสร้างโปรเจกต์

```text
ระบบจัดการกิจกรรมนิสิต/
├── Agent.md
├── README.md
├── DEPLOY.md
├── Dockerfile
├── docker-compose.yml
├── package.json
├── package-lock.json
├── server.js
├── db/
│   └── database.js
├── middleware/
│   ├── auth.js
│   └── role.js
├── routes/
│   ├── activities.js
│   ├── auth.js
│   ├── criteria.js
│   ├── evidence.js
│   ├── notifications.js
│   ├── reports.js
│   ├── stats.js
│   └── users.js
├── public/
│   ├── activities.html
│   ├── activity-detail.html
│   ├── calendar.html
│   ├── criteria.html
│   ├── dashboard.html
│   ├── login.html
│   ├── my-activities.html
│   ├── notifications.html
│   ├── submit-evidence.html
│   ├── shared/
│   │   ├── app.js
│   │   ├── calendar.js
│   │   ├── datepicker.js
│   │   ├── icons.js
│   │   └── style.css
│   └── staff/
│       ├── activities.html
│       ├── criteria.html
│       ├── dashboard.html
│       ├── evidence.html
│       ├── reports.html
│       └── users.html
└── uploads/
    └── .gitkeep
```

หมายเหตุสำคัญ: โปรเจกต์ปัจจุบันใช้ MySQL แล้ว ไม่ใช่ SQLite เอกสารเก่าบางจุดเคยอ้างถึง SQLite และถูกปรับในไฟล์นี้แล้ว

---

## วิธีรันระบบ

### ติดตั้ง dependency

```bash
npm install
```

### ตั้งค่า environment

คัดลอก `.env.example` เป็น `.env` แล้วตั้งค่าต่อไปนี้:

```env
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

DB_HOST=localhost
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=student_activities

SESSION_SECRET=change_this_to_random_secret_min_32_chars
JWT_SECRET=change_this_to_random_jwt_secret_min_32_chars

TSU_DOMAIN=tsu.ac.th
PORT=3000
NODE_ENV=production
```

### รัน

```bash
npm start
```

สำหรับ development:

```bash
npm run dev
```

เปิดเว็บที่ `http://localhost:3000`

ถ้ารันแล้วขึ้น `ECONNREFUSED` แปลว่า Express ต่อ MySQL ไม่ได้ ให้ตรวจว่า MySQL ทำงานอยู่และค่า `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` ถูกต้อง

---

## Server และ Routing

`server.js` เป็น entry point หลัก:

- โหลด `.env`
- เปิด `trust proxy` สำหรับ Coolify/Traefik
- เปิด gzip compression
- อ่าน JSON, form body และ cookie
- เสิร์ฟ `/uploads` พร้อม cache 7 วัน
- ผูก API routes ทั้งหมดภายใต้ `/api/*`
- ตรวจ JWT ก่อนส่ง HTML page
- แยกหน้า student และ staff ตาม role
- static files ใน `public/` ใช้ `Cache-Control: no-cache` เพื่อกันไฟล์ HTML/JS/CSS ค้างหลัง deploy

หน้า student:

- `/dashboard`
- `/activities`
- `/activity-detail`
- `/my-activities`
- `/submit-evidence`
- `/criteria`
- `/notifications`
- `/calendar`

หน้า staff:

- `/staff/dashboard`
- `/staff/activities`
- `/staff/evidence`
- `/staff/reports`
- `/staff/criteria`
- `/staff/users`

---

## Database

ไฟล์หลัก: `db/database.js`

การเชื่อมต่อ MySQL:

- ใช้ connection pool จาก `mysql2/promise`
- `connectionLimit: 10`
- `charset: utf8mb4`
- `timezone: '+07:00'`
- `dateStrings: ['DATE', 'DATETIME']` เพื่อให้ frontend ได้วันที่/เวลาเป็น string ไม่โดนแปลง timezone ผิด

`init()` จะสร้างตารางอัตโนมัติถ้ายังไม่มี และมีระบบเพิ่มคอลัมน์เสริมสำหรับ deployment เก่าด้วย `ensureColumn()`

### ตารางหลัก

#### `users`

เก็บผู้ใช้จาก Google OAuth

| Column | หมายเหตุ |
|---|---|
| `id` | primary key |
| `google_id` | Google OAuth ID |
| `email` | unique, จำกัดโดเมน TSU ตามค่า `TSU_DOMAIN` |
| `name` | ชื่อจาก Google |
| `student_id` | รหัสนิสิต |
| `role` | `student` หรือ `staff` |
| `avatar_url` | รูปโปรไฟล์ |
| `created_at` | เวลาสร้าง |

#### `activity_categories`

หมวดหมู่/เกณฑ์กิจกรรม

| Column | หมายเหตุ |
|---|---|
| `id` | primary key |
| `name` | ชื่อหมวด |
| `description` | รายละเอียด |
| `min_hours` | ชั่วโมงขั้นต่ำ |
| `created_at` | เวลาสร้าง |

มี seed เริ่มต้น 5 หมวด:

- กิจกรรมบำเพ็ญประโยชน์
- กิจกรรมพัฒนาทักษะ
- กิจกรรมนันทนาการ
- กิจกรรมวิชาการ
- กิจกรรมนิสิตสัมพันธ์

#### `activities`

เก็บกิจกรรม

| Column | หมายเหตุ |
|---|---|
| `id` | primary key |
| `title` | ชื่อกิจกรรม |
| `description` | รายละเอียด |
| `category_id` | FK ไป `activity_categories` |
| `date` | วันที่เริ่มกิจกรรม |
| `end_date` | วันที่สิ้นสุดกิจกรรม ใช้กับกิจกรรมหลายวัน |
| `start_time` | เวลาเริ่มกิจกรรม |
| `end_time` | เวลาจบกิจกรรม |
| `registration_start_at` | วันเวลาเปิดรับสมัคร |
| `registration_end_at` | วันเวลาปิดรับสมัคร |
| `location` | สถานที่ |
| `capacity` | 0 หมายถึงไม่จำกัด |
| `hours_credit` | ชั่วโมงกิจกรรม |
| `status` | `open`, `closed`, `cancelled` |
| `created_by` | staff ที่สร้าง |
| `created_at`, `updated_at` | audit time |

คอลัมน์ `end_date`, `registration_start_at`, `registration_end_at` ถูกจัดเป็น optional compatibility column ผ่านตัวแปร `activityColumns` เพื่อให้ระบบไม่ล่มถ้าฐานข้อมูลเก่ายัง migrate ไม่ครบ

#### `activity_locations`

เก็บห้อง/สถานที่ล่วงหน้าสำหรับ staff เลือกใช้ตอนสร้างกิจกรรม

| Column | หมายเหตุ |
|---|---|
| `id` | primary key |
| `name` | ชื่อห้อง/สถานที่ unique |
| `created_at` | เวลาสร้าง |

#### `activity_registrations`

เก็บการลงทะเบียนกิจกรรม

| Column | หมายเหตุ |
|---|---|
| `id` | primary key |
| `activity_id` | FK ไป `activities` |
| `user_id` | FK ไป `users` |
| `status` | `registered`, `attended`, `absent` |
| `registered_at` | เวลาลงทะเบียน |
| `checked_in_at` | เวลาเช็กชื่อ |

มี unique key `activity_id + user_id`

#### `evidence_submissions`

เก็บหลักฐานกิจกรรม

| Column | หมายเหตุ |
|---|---|
| `id` | primary key |
| `user_id` | เจ้าของหลักฐาน |
| `activity_id` | กิจกรรม |
| `file_path` | path ไฟล์ใน `/uploads` |
| `file_type` | ประเภทไฟล์ |
| `description` | คำอธิบาย |
| `status` | `pending`, `approved`, `rejected` |
| `reviewer_id` | staff ผู้ตรวจ |
| `reviewer_note` | หมายเหตุจาก staff |
| `reviewed_at`, `submitted_at` | เวลาตรวจ/ยื่น |

#### `notifications`

เก็บการแจ้งเตือน

| Column | หมายเหตุ |
|---|---|
| `id` | primary key |
| `user_id` | ผู้รับ |
| `title` | หัวข้อ |
| `message` | ข้อความ |
| `type` | เช่น `info`, `evidence_approved`, `evidence_rejected` |
| `is_read` | 0/1 |
| `created_at` | เวลาสร้าง |

---

## API Reference

### Auth

| Method | Endpoint | สิทธิ์ | คำอธิบาย |
|---|---|---|---|
| GET | `/api/auth/google` | public | เริ่ม Google OAuth |
| GET | `/api/auth/google/callback` | public | OAuth callback |
| GET | `/api/auth/me` | login | user ปัจจุบัน |
| POST | `/api/auth/logout` | login | ออกจากระบบ |

### Activities

| Method | Endpoint | สิทธิ์ | คำอธิบาย |
|---|---|---|---|
| GET | `/api/activities` | login | รายการกิจกรรม พร้อม search/filter/pagination |
| GET | `/api/activities/debug/time` | staff | debug เวลา server และ database |
| GET | `/api/activities/locations` | login | รายการห้อง/สถานที่ที่บันทึกไว้ |
| POST | `/api/activities/locations` | staff | เพิ่มห้อง/สถานที่ล่วงหน้า |
| DELETE | `/api/activities/locations/:id` | staff | ลบห้อง/สถานที่ล่วงหน้า |
| GET | `/api/activities/:id` | login | รายละเอียดกิจกรรม |
| PUT | `/api/activities/:id/status` | staff | เปิด/ปิด/ยกเลิกรับสมัครแบบลัด |
| POST | `/api/activities` | staff | สร้างกิจกรรม |
| PUT | `/api/activities/:id` | staff | แก้ไขกิจกรรม |
| DELETE | `/api/activities/:id` | staff | ลบกิจกรรม |
| POST | `/api/activities/:id/register` | student | ลงทะเบียนกิจกรรม |
| DELETE | `/api/activities/:id/register` | student | ยกเลิกลงทะเบียน |

`GET /api/activities` รองรับ query:

| Query | ตัวอย่าง | หมายเหตุ |
|---|---|---|
| `search` | `อบรม` | ค้นชื่อ รายละเอียด สถานที่ |
| `category` | `1` | filter หมวดหมู่ |
| `status` | `open` | `open`, `closed`, `cancelled` |
| `date` | `2026-06-13` | ถ้าเป็นกิจกรรมหลายวันจะ match ในช่วง `date` ถึง `end_date` |
| `page` | `1` | default 1 |
| `limit` | `10` | default 10 |

ฟิลด์กิจกรรมที่ API ส่งกลับมีข้อมูลช่วย frontend เช่น:

- `category_name`
- `registered_count`
- `is_registered`
- `registration_not_started`
- `registration_ended`
- `registration_after_start`
- `registration_before_end`

กติกาการลงทะเบียน:

- ต้องเป็น `student`
- กิจกรรมต้อง `status = open`
- ถ้าตั้ง `registration_start_at` ต้องถึงเวลาเปิดรับสมัครแล้ว
- ถ้าตั้ง `registration_end_at` ต้องยังไม่หมดเวลารับสมัคร
- ถ้าเลยช่วงรับสมัครแล้ว คนที่ยังไม่ลงสมัครจะสมัครไม่ได้ และคนที่ลงสมัครแล้วจะยกเลิกไม่ได้

### Evidence

| Method | Endpoint | สิทธิ์ | คำอธิบาย |
|---|---|---|---|
| GET | `/api/evidence` | staff | รายการหลักฐานทั้งหมด พร้อม filter/pagination |
| GET | `/api/evidence/my` | student | หลักฐานของฉัน |
| POST | `/api/evidence` | student | ยื่นหลักฐาน multipart/form-data |
| PUT | `/api/evidence/:id/review` | staff | อนุมัติหรือปฏิเสธหลักฐาน |

ไฟล์หลักฐานรองรับ JPG, PNG, PDF, GIF ขนาดสูงสุด 10MB

### Criteria

| Method | Endpoint | สิทธิ์ | คำอธิบาย |
|---|---|---|---|
| GET | `/api/criteria` | login | รายการหมวดหมู่ และ progress ของ student |
| POST | `/api/criteria` | staff | สร้างหมวดหมู่ |
| PUT | `/api/criteria/:id` | staff | แก้ไขหมวดหมู่ |
| DELETE | `/api/criteria/:id` | staff | ลบหมวดหมู่ |

สีของหมวดหมู่ถูกจัดฝั่ง frontend ด้วย `categoryThemeKey()` และ `categoryBadge()` ใน `public/shared/app.js` เพื่อให้หน้า dashboard, criteria และรายการกิจกรรมอ่านง่ายขึ้น

### Notifications

| Method | Endpoint | สิทธิ์ | คำอธิบาย |
|---|---|---|---|
| GET | `/api/notifications/my` | login | การแจ้งเตือนของ user ปัจจุบัน |
| PUT | `/api/notifications/read-all` | login | ทำเครื่องหมายอ่านทั้งหมด |
| PUT | `/api/notifications/:id/read` | login | ทำเครื่องหมายอ่านรายการเดียว |

สถานะล่าสุดของ UI: เมนูแจ้งเตือนของนิสิตใช้ popover/message box ที่ไอคอนแจ้งเตือน ไม่ใช่เปิดเป็นเมนูเต็มหน้าใน sidebar

### Reports

| Method | Endpoint | สิทธิ์ | คำอธิบาย |
|---|---|---|---|
| GET | `/api/reports/students` | staff | export CSV รายงานนิสิต |
| GET | `/api/reports/summary` | staff | summary รายบุคคล |

### Stats

| Method | Endpoint | สิทธิ์ | คำอธิบาย |
|---|---|---|---|
| GET | `/api/stats/dashboard` | login | ข้อมูล dashboard แยกตาม role |

staff dashboard ใช้เงื่อนไข registration window ตอนนับกิจกรรมที่เปิดรับสมัคร ไม่ได้นับแค่ `status = open`

### Users

| Method | Endpoint | สิทธิ์ | คำอธิบาย |
|---|---|---|---|
| GET | `/api/users` | staff | รายการผู้ใช้ พร้อมค้นหา/pagination |
| PUT | `/api/users/:id/role` | staff | เปลี่ยน role |
| PUT | `/api/users/me/student-id` | login | บันทึกรหัสนิสิตของตัวเอง |

---

## Frontend Shared Utilities

ไฟล์สำคัญ: `public/shared/app.js`

หน้าที่หลัก:

- `api.get/post/put/del()` สำหรับเรียก API และจัด error
- `toast()` สำหรับแจ้งผล
- `renderLayout()` และ navigation ตาม role
- `renderPagination()` สำหรับหน้าที่มีรายการจำนวนมาก
- `confirmDialog()` modal ยืนยัน action แบบ custom แทน `window.confirm`
- `logout()` เปิด modal ยืนยันก่อนออกจากระบบ
- `categoryThemeKey()` และ `categoryBadge()` สำหรับแสดงสีหมวดกิจกรรม
- `formatHourNumber()` และ `formatHours()` แสดงชั่วโมงกิจกรรมโดยไม่บังคับทศนิยม
- `activityDateLabel()`, `activityTimeLabel()`, `activityScheduleLabel()` สำหรับจัดข้อความวันเวลา
- `splitDateTime()` และ `buildDateTime()` สำหรับฟอร์มตั้งช่วงเปิดรับสมัคร
- `registrationState()` และ `activityStatusBadge()` สำหรับสถานะสมัคร

ไฟล์อื่นใน `public/shared/`:

- `style.css`: design system, layout, badges, modal, notification popover, time debug card, location preset, custom date/time UI
- `datepicker.js`: date/time picker ที่ใช้ในฟอร์ม staff รองรับเลือกเวลาและคลิก/ดับเบิลคลิกเพื่อพิมพ์ตัวเลข
- `calendar.js`: logic ปฏิทินกิจกรรม
- `icons.js`: SVG icon helper

---

## UX/UI ล่าสุดที่ควรรักษาไว้

- Dashboard นิสิตต้องอ่านง่ายสำหรับผู้ใช้ทั่วไป ไม่ถือว่าผู้ใช้เป็นสายคอม
- ใช้สีแยกประเภทกิจกรรมทุกที่ที่ต้องเทียบหมวดหมู่ เช่น dashboard, criteria, activity list
- ชั่วโมงกิจกรรมแสดงเป็นเลขจำนวนเต็มเมื่อไม่มีทศนิยม เช่น `3 ชั่วโมง` ไม่ใช่ `3.0 ชั่วโมง`
- Logout button ต้องเด่นและเปิด modal ยืนยันก่อนออก
- Action สำคัญของ staff เช่น ลบกิจกรรม เปลี่ยนสถานะ ตรวจหลักฐาน ลบหมวดหมู่ เปลี่ยน role ต้องใช้ `confirmDialog()`
- หน้าแจ้งเตือนของนิสิตใช้ popover/message box จากไอคอนแจ้งเตือน
- ฟอร์ม staff activities รองรับ:
  - กิจกรรมวันเดียวหรือหลายวัน (`date`, `end_date`)
  - เปิด/ปิดช่วงรับสมัคร (`registration_start_at`, `registration_end_at`)
  - ปุ่มลัดเปิด/ปิด/ยกเลิกสถานะรับสมัคร
  - เลือกห้อง/สถานที่จากรายการที่บันทึกไว้
  - debug เวลา server/database ในหน้า staff เพื่อเทียบเวลาปิดรับสมัคร

---

## Security Notes

- JWT เก็บใน `httpOnly` cookie
- Google OAuth จำกัดโดเมนตาม `TSU_DOMAIN` ค่าเริ่มต้นคือ `tsu.ac.th`
- API ที่ต้อง login ใช้ `requireAuth`
- API staff ใช้ `requireRole('staff')`
- ใช้ prepared statements ของ `mysql2` ทุก query ที่รับค่าจากผู้ใช้
- Upload จำกัดชนิดไฟล์และขนาด
- อย่า commit `.env`, `node_modules`, หรือไฟล์ runtime ที่ไม่จำเป็น

---

## คำสั่งที่ใช้บ่อย

### ตรวจสถานะ Git

```bash
git status --short
git log --oneline -5
```

### ตรวจ syntax ฝั่ง Node

```bash
node --check server.js
node --check db/database.js
node --check routes/activities.js
node --check routes/auth.js
node --check routes/criteria.js
node --check routes/evidence.js
node --check routes/notifications.js
node --check routes/reports.js
node --check routes/stats.js
node --check routes/users.js
node --check public/shared/app.js
node --check public/shared/calendar.js
node --check public/shared/datepicker.js
node --check public/shared/icons.js
```

### ตรวจ inline script ใน HTML

```bash
node -e "const fs=require('fs'),path=require('path');function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(x=>{const p=path.join(d,x.name);return x.isDirectory()?walk(p):p})}let ok=true;for(const f of walk('public').filter(f=>f.endsWith('.html'))){const h=fs.readFileSync(f,'utf8');[...h.matchAll(/<script(?![^>]*\\bsrc=)[^>]*>([\\s\\S]*?)<\\/script>/gi)].forEach((m,i)=>{try{new Function(m[1])}catch(e){ok=false;console.error('FAIL '+f+' script '+(i+1)+': '+e.message)}})}console.log(ok?'OK':'HTML script check failed');process.exit(ok?0:1)"
```

### รันแอป

```bash
npm start
```

---

## แนวทางทำงานสำหรับ Agent ถัดไป

1. อ่าน `Agent.md` ก่อน จากนั้นค่อยอ่านไฟล์ที่เกี่ยวข้องกับงานจริง
2. ตรวจ `git status --short` ก่อนแก้ทุกครั้ง เพราะอาจมีงานของผู้ใช้ค้างอยู่
3. ห้าม revert งานที่ไม่ได้ทำเอง
4. ใช้ `rg` ค้นหาไฟล์/ข้อความก่อนใช้คำสั่งที่ช้ากว่า
5. แก้ไฟล์แบบ scoped ตามคำขอ อย่า refactor ใหญ่โดยไม่จำเป็น
6. ถ้าแก้ frontend ให้ตรวจอย่างน้อย syntax ของ JS และ inline script
7. ถ้าแก้ behavior ที่พึ่ง DB ให้ทดสอบจริงเมื่อ MySQL พร้อม ถ้า DB ไม่พร้อมให้บอกข้อจำกัดชัดเจน
8. หลังแก้ shared JS/CSS ควร bump query version ใน HTML ที่ import asset เพื่อกัน browser cache
9. ถ้าเพิ่ม API ใหม่ ให้เพิ่มในเอกสารนี้ด้วย
10. ถ้าเปลี่ยน schema ให้เพิ่มทั้ง `CREATE TABLE` และ migration/compatibility path ใน `db/database.js`

---

## สถานะ Git ล่าสุดที่ทราบ

remote หลัก: `origin git@github.com:anonsrirat/Student_Activities.git`
branch หลัก: `main`

commit ล่าสุดก่อนอัปเดตเอกสารนี้:

```text
7dd30b9 ปรับปรุงการรับสมัครและยืนยันแอคชัน
898f0df แก้ปัญหาแคชไฟล์ทำให้โหลดกิจกรรมไม่ได้
dc75e98 แก้โหลดข้อมูลเมื่อฐานข้อมูลยังไม่อัปเดต
e6e2dfd ปรับปรุง UX กิจกรรมและการตั้งเวลา
3d50bd2 ปรับปรุงครั้งใหญ่: ไอคอน SVG + ปฏิทินกิจกรรม + เพิ่มความเร็ว
```

ไฟล์ `.serena/` เป็น metadata ของเครื่องมือช่วยโค้ดในเครื่อง ไม่ควร commit เว้นแต่ผู้ดูแลโปรเจกต์สั่งชัดเจน
