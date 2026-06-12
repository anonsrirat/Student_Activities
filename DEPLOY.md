# การ Deploy บน Coolify

## สิ่งที่ต้องเตรียม
- Coolify server พร้อมใช้งาน
- Domain ที่ชี้มาที่ Coolify server (สำหรับ Google OAuth callback)
- GitHub repo: `anonsrirat/Student_Activities`

---

## ขั้นตอนการ Deploy

### 1. สร้าง Resource ใน Coolify

**วิธี A: ใช้ Docker Compose (แนะนำ — รวม MySQL อยู่ในนั้น)**

1. ไปที่ Coolify Dashboard → **+ New Resource** → **Docker Compose**
2. เลือก **Public Repository** หรือ **Private Repository** (GitHub)
3. ใส่ URL: `https://github.com/anonsrirat/Student_Activities`
4. Branch: `main`
5. Docker Compose Location: `/docker-compose.yml`
6. กรอก Environment Variables (ดูด้านล่าง)
7. กด **Deploy**

**วิธี B: แยก MySQL Service**

1. สร้าง **MySQL** resource ใน Coolify ก่อน
2. จด credentials (host, port, user, password, database)
3. สร้าง **Dockerfile** application:
   - **+ New Resource** → **Public Repository (Dockerfile)**
   - URL: `https://github.com/anonsrirat/Student_Activities`
   - Build Pack: `Dockerfile`
4. ใส่ Environment Variables ที่ชี้ไปที่ MySQL service ที่สร้างไว้

---

### 2. Environment Variables ที่ต้องตั้งใน Coolify

```env
# Google OAuth
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxx
GOOGLE_CALLBACK_URL=https://your-domain.com/api/auth/google/callback

# MySQL
DB_HOST=mysql                # ชื่อ service ใน docker-compose หรือ host ที่ Coolify ให้
DB_PORT=3306
DB_USER=appuser
DB_PASSWORD=strong_password_here
DB_NAME=student_activities
MYSQL_ROOT_PASSWORD=root_strong_password   # ใช้กรณี docker-compose แบบ A

# Secrets (สุ่มอย่างน้อย 32 ตัว)
SESSION_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
JWT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Other
TSU_DOMAIN=tsu.ac.th
NODE_ENV=production
PORT=3000
```

> **เคล็ดลับ:** สุ่ม secret ได้ที่ https://generate-secret.vercel.app/64

---

### 3. ตั้งค่า Domain + HTTPS

1. ใน Coolify → Application → **Domains**
2. เพิ่ม domain ที่ต้องการ (เช่น `activities.tsu.ac.th`)
3. Enable **Force HTTPS** (Coolify จะออก Let's Encrypt ให้อัตโนมัติ)
4. **สำคัญ:** กลับไปอัปเดต `GOOGLE_CALLBACK_URL` ให้ตรงกับ domain นี้
   - `https://activities.tsu.ac.th/api/auth/google/callback`

---

### 4. อัปเดต Google Cloud Console

1. ไปที่ [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**
2. แก้ไข OAuth Client ID ที่ใช้
3. เพิ่ม **Authorized redirect URIs:**
   - `https://activities.tsu.ac.th/api/auth/google/callback` (production)
   - `http://localhost:3000/api/auth/google/callback` (สำหรับ dev)
4. บันทึก

---

### 5. ตั้ง Staff คนแรก

หลัง deploy ครั้งแรก เข้าระบบครั้งหนึ่ง (ทุกคนจะเป็น `student` โดยอัตโนมัติ) จากนั้น:

**วิธี A: เข้า MySQL ตรงๆ ผ่าน Coolify Terminal**
```sql
UPDATE users SET role = 'staff' WHERE email = 'your_email@tsu.ac.th';
```

**วิธี B: ใช้ Coolify MySQL Console**
- เปิด terminal ของ MySQL container
- รัน `mysql -u root -p`
- ใช้ database: `USE student_activities;`
- รัน UPDATE statement

---

## การ Update Application

Coolify จะ rebuild + redeploy อัตโนมัติเมื่อมี push ใหม่บน branch `main`
(ถ้าเปิด **Auto Deploy on Git Push** ไว้)

หรือ manual: กดปุ่ม **Redeploy** ใน Coolify dashboard

---

## Troubleshooting

| ปัญหา | สาเหตุ / วิธีแก้ |
|------|---------|
| `ECONNREFUSED` ตอน start | MySQL container ยังไม่พร้อม — รอ 30 วิ แล้ว restart app |
| Login redirect ไป `/login?error=domain` | email ไม่ใช่ `@tsu.ac.th` — เช็ค `TSU_DOMAIN` env |
| Login redirect ไป `/login?error=token` | `GOOGLE_CALLBACK_URL` ไม่ตรงกับที่ตั้งใน Google Cloud |
| 500 error ตอนเรียก API | เช็ค logs ของ container ผ่าน Coolify dashboard |
| ไฟล์ upload หายเมื่อ redeploy | ต้อง mount volume `uploads_data` (มีอยู่ใน docker-compose แล้ว) |

---

## รัน Local Development (ไม่ใช้ Docker)

```bash
# 1. ติดตั้ง MySQL local
# 2. สร้าง database
mysql -u root -p
CREATE DATABASE student_activities CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 3. ตั้งค่า .env
cp .env.example .env
# แก้ไขค่าใน .env

# 4. รัน
npm install
npm start
```
