# Agent.md — ระบบจัดการกิจกรรมนิสิต TSU

## ภาพรวมระบบ

**ชื่อระบบ:** ระบบจัดการกิจกรรมนิสิต มหาวิทยาลัยทักษิณ  
**วัตถุประสงค์:** จัดการ ติดตาม และประเมินกิจกรรมของนิสิตมหาวิทยาลัย  
**กลุ่มผู้พัฒนา:**
- นายอานนท์ ศรีรัฐ รหัสนิสิต 6720210057
- นายวรพล บัวแก้ว รหัสนิสิต 6720210050
- นายศุภกร ยางสมบูรณ์ รหัสนิสิต 6720210102

---

## Tech Stack

| ส่วน | เทคโนโลยี |
|------|-----------|
| Runtime | Node.js ≥ 18 |
| Framework | Express 4.x |
| Database | MySQL 8.0 (mysql2/promise) |
| Deployment | Docker + Coolify |
| Auth | Google OAuth 2.0 + JWT |
| Frontend | HTML5 + CSS3 + Vanilla JS |
| File Upload | multer |

---

## โครงสร้างโปรเจกต์

```
ระบบจัดการกิจกรรมนิสิต/
├── Agent.md              ← เอกสารนี้
├── server.js             ← Express entry point
├── package.json
├── .env.example          ← Template สำหรับ environment variables
├── .gitignore
├── db/
│   └── database.js       ← SQLite init + schema + seed data
├── middleware/
│   ├── auth.js           ← JWT cookie verification
│   └── role.js           ← Role-based access control
├── routes/
│   ├── auth.js           ← Google OAuth flow + /me + /logout
│   ├── activities.js     ← CRUD กิจกรรม + ลงทะเบียน
│   ├── evidence.js       ← ยื่น/ตรวจหลักฐาน
│   ├── criteria.js       ← CRUD หมวดหมู่/เกณฑ์
│   ├── notifications.js  ← การแจ้งเตือน
│   ├── reports.js        ← CSV export + summary
│   ├── stats.js          ← Dashboard statistics
│   └── users.js          ← จัดการผู้ใช้
├── public/
│   ├── login.html
│   ├── dashboard.html
│   ├── activities.html
│   ├── activity-detail.html
│   ├── my-activities.html
│   ├── submit-evidence.html
│   ├── criteria.html
│   ├── notifications.html
│   ├── staff/
│   │   ├── dashboard.html
│   │   ├── activities.html
│   │   ├── evidence.html
│   │   ├── reports.html
│   │   ├── criteria.html
│   │   └── users.html
│   └── shared/
│       ├── style.css     ← Design system ทั้งหมด
│       └── app.js        ← Shared utilities (api, toast, layout, ฯลฯ)
├── uploads/              ← ไฟล์หลักฐานที่อัปโหลด
└── data/                 ← SQLite database (สร้างอัตโนมัติ)
```

---

## การติดตั้งและรันระบบ

### 1. ติดตั้ง Dependencies
```bash
npm install
```

### 2. ตั้งค่า Environment Variables
```bash
# คัดลอก .env.example เป็น .env
copy .env.example .env
# แก้ไขค่าใน .env
```

### 3. ตั้งค่า Google OAuth
1. ไปที่ [Google Cloud Console](https://console.cloud.google.com/)
2. สร้าง Project ใหม่
3. เปิดใช้งาน **Google+ API** และ **Google OAuth 2.0**
4. ไปที่ **APIs & Services → Credentials → Create OAuth Client ID**
5. Application type: **Web application**
6. Authorized redirect URIs: `http://localhost:3000/api/auth/google/callback`
7. คัดลอก Client ID และ Client Secret ใส่ใน `.env`

### 4. รันระบบ
```bash
npm start
# หรือสำหรับ development (auto-restart)
npm run dev
```

เปิดเบราว์เซอร์ที่ `http://localhost:3000`

---

## กลุ่มผู้ใช้และสิทธิ์

| Role | คำอธิบาย | วิธีกำหนด |
|------|----------|-----------|
| `student` | นิสิตทั่วไป (default) | สร้างอัตโนมัติเมื่อ login |
| `staff` | เจ้าหน้าที่ฝ่ายกิจการนิสิต | เปลี่ยนใน `/staff/users` |

---

## API Reference

### Authentication
| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| GET | `/api/auth/google` | เริ่มต้น Google OAuth |
| GET | `/api/auth/google/callback` | OAuth callback |
| GET | `/api/auth/me` | ข้อมูล user ปัจจุบัน |
| POST | `/api/auth/logout` | ออกจากระบบ |

### Activities
| Method | Endpoint | สิทธิ์ | คำอธิบาย |
|--------|----------|--------|----------|
| GET | `/api/activities` | ทุกคน | รายการกิจกรรม (search, filter, pagination) |
| GET | `/api/activities/:id` | ทุกคน | รายละเอียดกิจกรรม |
| POST | `/api/activities` | staff | สร้างกิจกรรม |
| PUT | `/api/activities/:id` | staff | แก้ไขกิจกรรม |
| DELETE | `/api/activities/:id` | staff | ลบกิจกรรม |
| POST | `/api/activities/:id/register` | student | ลงทะเบียน |
| DELETE | `/api/activities/:id/register` | student | ยกเลิกการลงทะเบียน |

#### Query Parameters (GET /api/activities)
| Parameter | ประเภท | คำอธิบาย |
|-----------|--------|----------|
| `search` | string | ค้นหาชื่อ/รายละเอียด/สถานที่ |
| `category` | number | ID หมวดหมู่ |
| `status` | string | open / closed / cancelled |
| `date` | string | YYYY-MM-DD |
| `page` | number | หน้า (default: 1) |
| `limit` | number | จำนวนต่อหน้า (default: 10) |

### Evidence
| Method | Endpoint | สิทธิ์ | คำอธิบาย |
|--------|----------|--------|----------|
| GET | `/api/evidence` | staff | รายการหลักฐานทั้งหมด |
| GET | `/api/evidence/my` | student | หลักฐานของฉัน |
| POST | `/api/evidence` | student | ยื่นหลักฐาน (multipart/form-data) |
| PUT | `/api/evidence/:id/review` | staff | อนุมัติ/ปฏิเสธ |

#### POST /api/evidence (form-data)
| Field | ประเภท | คำอธิบาย |
|-------|--------|----------|
| `activity_id` | number | ID กิจกรรม |
| `file` | file | ไฟล์หลักฐาน (JPG/PNG/PDF/GIF, max 10MB) |
| `description` | string | คำอธิบาย |

### Criteria (หมวดหมู่)
| Method | Endpoint | สิทธิ์ | คำอธิบาย |
|--------|----------|--------|----------|
| GET | `/api/criteria` | ทุกคน | รายการ + ความคืบหน้า (student) |
| POST | `/api/criteria` | staff | สร้างหมวดหมู่ |
| PUT | `/api/criteria/:id` | staff | แก้ไข |
| DELETE | `/api/criteria/:id` | staff | ลบ |

### Reports
| Method | Endpoint | สิทธิ์ | คำอธิบาย |
|--------|----------|--------|----------|
| GET | `/api/reports/students` | staff | Export CSV |
| GET | `/api/reports/summary` | staff | สรุปรายนิสิต |

### Stats
| Method | Endpoint | สิทธิ์ | คำอธิบาย |
|--------|----------|--------|----------|
| GET | `/api/stats/dashboard` | ทุกคน | ข้อมูล dashboard (ต่างกันตาม role) |

---

## Database Schema

### users
| Column | Type | หมายเหตุ |
|--------|------|---------|
| id | INTEGER PK | |
| google_id | TEXT UNIQUE | Google OAuth ID |
| email | TEXT UNIQUE | @tsu.ac.th |
| name | TEXT | ชื่อจาก Google |
| student_id | TEXT | รหัสนิสิต (optional) |
| role | TEXT | 'student' / 'staff' |
| avatar_url | TEXT | รูปโปรไฟล์ |
| created_at | DATETIME | |

### activities
| Column | Type | หมายเหตุ |
|--------|------|---------|
| id | INTEGER PK | |
| title | TEXT | ชื่อกิจกรรม |
| description | TEXT | รายละเอียด |
| category_id | INTEGER FK | → activity_categories |
| date | TEXT | YYYY-MM-DD |
| start_time / end_time | TEXT | HH:MM |
| location | TEXT | สถานที่ |
| capacity | INTEGER | 0 = ไม่จำกัด |
| hours_credit | REAL | ชั่วโมงที่ได้รับ |
| status | TEXT | open / closed / cancelled |
| created_by | INTEGER FK | → users |

### activity_categories
| Column | Type | หมายเหตุ |
|--------|------|---------|
| id | INTEGER PK | |
| name | TEXT | ชื่อหมวดหมู่ |
| description | TEXT | |
| min_hours | REAL | ชั่วโมงขั้นต่ำ |

### activity_registrations
| Column | Type | หมายเหตุ |
|--------|------|---------|
| activity_id | INTEGER FK | |
| user_id | INTEGER FK | |
| status | TEXT | registered / attended / absent |
| UNIQUE(activity_id, user_id) | | |

### evidence_submissions
| Column | Type | หมายเหตุ |
|--------|------|---------|
| user_id / activity_id | INTEGER FK | |
| file_path | TEXT | path ไฟล์ใน /uploads |
| description | TEXT | |
| status | TEXT | pending / approved / rejected |
| reviewer_id | INTEGER FK | เจ้าหน้าที่ที่ตรวจ |
| reviewer_note | TEXT | หมายเหตุ |

### notifications
| Column | Type | หมายเหตุ |
|--------|------|---------|
| user_id | INTEGER FK | |
| title / message | TEXT | |
| type | TEXT | evidence_approved / rejected / info |
| is_read | INTEGER | 0/1 |

---

## Functional Requirements

| รหัส | ฟังก์ชัน | สถานะ |
|------|---------|-------|
| FR001 | นิสิต login ผ่าน Google TSU (@tsu.ac.th) | ✅ |
| FR002 | นิสิตดูตาราง/เกณฑ์กิจกรรม | ✅ |
| FR003 | นิสิตยื่นหลักฐานเข้าร่วมกิจกรรม | ✅ |
| FR004 | เจ้าหน้าที่ CRUD กิจกรรม | ✅ |
| FR005 | เจ้าหน้าที่ login ผ่าน Google TSU | ✅ |
| FR006 | นิสิตลงทะเบียนเข้าร่วมกิจกรรม | ✅ |
| FR007 | เจ้าหน้าที่อนุมัติ/ปฏิเสธหลักฐาน | ✅ |
| FR008 | ระบบแจ้งเตือนเมื่ออนุมัติ/ปฏิเสธ | ✅ |
| FR009 | Search & Filter กิจกรรม | ✅ |
| FR010 | Export รายงาน CSV | ✅ |
| FR011 | Dashboard สรุปสถานะกิจกรรม | ✅ |
| FR012 | เจ้าหน้าที่กำหนด/แก้ไขเกณฑ์ | ✅ |

## Non-Functional Requirements

| รหัส | ข้อกำหนด | การรองรับ |
|------|---------|----------|
| NFR001 | รองรับ 100 users พร้อมกัน | SQLite WAL mode + stateless JWT |
| NFR002 | แสดงผลภายใน 3 วินาที | SQLite sync query + static HTML |
| NFR003 | ระบบสิทธิ์ | JWT + Role middleware |
| NFR004 | เชื่อมต่อระบบทะเบียน | Google OAuth จำกัด @tsu.ac.th |

---

## Security Notes

- JWT เก็บใน `httpOnly` cookie (ป้องกัน XSS)
- Google OAuth จำกัดเฉพาะ domain `tsu.ac.th`
- File upload จำกัด type (JPG/PNG/PDF/GIF) และขนาด (10MB)
- Role-based middleware บน ทุก API endpoint
- SQL Injection: ใช้ prepared statements ทุกที่

---

## หน้าต่างๆ

| URL | สิทธิ์ | คำอธิบาย |
|-----|--------|----------|
| `/login` | ทุกคน | หน้าเข้าสู่ระบบ |
| `/dashboard` | student | แดชบอร์ดนิสิต |
| `/activities` | student | รายการกิจกรรม |
| `/activity-detail?id=X` | student | รายละเอียดกิจกรรม |
| `/my-activities` | student | กิจกรรมที่ลงทะเบียน |
| `/submit-evidence?id=X` | student | ยื่นหลักฐาน |
| `/criteria` | student | เกณฑ์และความคืบหน้า |
| `/notifications` | student | การแจ้งเตือน |
| `/staff/dashboard` | staff | แดชบอร์ดเจ้าหน้าที่ |
| `/staff/activities` | staff | จัดการกิจกรรม |
| `/staff/evidence` | staff | ตรวจหลักฐาน |
| `/staff/reports` | staff | รายงาน + Export CSV |
| `/staff/criteria` | staff | จัดการเกณฑ์ |
| `/staff/users` | staff | จัดการผู้ใช้ |
