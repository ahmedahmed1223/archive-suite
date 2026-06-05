# دليل النشر على Hostinger VPS

هذا دليل خطوة-بخطوة لنشر `archive-suite` على Hostinger VPS. كامل التثبيت
يستغرق ~30 دقيقة لأوّل مرّة، و~3 دقائق للتحديثات اللاحقة.

## ما تحتاجه قبل البدء

- **خطّة Hostinger VPS** (KVM 1 على الأقل: 1 vCPU، 4GB RAM، 50GB SSD)
- **اسم نطاق** تتحكّم به (Hostinger Registrar أو غيره)
- **عميل SSH** على جهازك (مدمج في Windows 10+ و macOS و Linux)
- **بريد إلكتروني** لتنبيهات Let's Encrypt

> الخطّة الأرخص KVM 1 كافية لـ <1000 فيديو + 5 مستخدمين. ارفع إلى KVM 2 إذا
> رفعت ملفّات وسائط كبيرة أو لديك >20 مستخدمًا متزامنًا.

## 1. إعداد VPS

من لوحة Hostinger:
1. اطلب VPS واختر **Ubuntu 24.04 LTS** (الأحدث LTS).
2. انتظر التزويد (~3 دقائق)، ستحصل على **IP عام** و**كلمة مرور root**.
3. في **DNS Zone Editor** لنطاقك، أضف سجلَّيْن:
   - `A` لـ `@` يشير إلى IP الـ VPS
   - `A` لـ `www` يشير إلى IP الـ VPS (اختياري)
4. انتظر انتشار DNS (5-30 دقيقة). اختبر:
   ```bash
   nslookup archive.example.com
   ```
   يجب أن يعيد IP الـ VPS قبل المتابعة (وإلا Let's Encrypt سيفشل).

## 2. الدخول إلى VPS وتقوية الأمان

```bash
ssh root@<VPS_IP>
# أوّل تسجيل دخول: أنشئ مستخدمًا غير root لتشغيل الـ stack
adduser archive
usermod -aG sudo archive
# انسخ مفتاح SSH العام (إن كنت تستخدم مفاتيح بدل كلمة المرور)
rsync --archive --chown=archive:archive ~/.ssh /home/archive
# اختياري قوي: عطّل root SSH وتسجيل الدخول بكلمة المرور
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd
# انتقل للمستخدم الجديد
su - archive
```

افتح جدار الحماية لمنفذي HTTP/HTTPS فقط (SSH عبر 22):
```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

## 3. تثبيت Docker + Docker Compose

```bash
# Docker Engine الرسمي (يأتي مع compose plugin)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# سجّل خروج ودخول لتفعيل عضوية المجموعة
exit
ssh archive@<VPS_IP>
# تحقّق
docker --version
docker compose version
```

## 4. تنزيل Archive Suite وضبط .env

```bash
git clone https://github.com/ahmedahmed1223/archive-suite.git
cd archive-suite/archive-server
```

### الطريق الموصى به (Postgres مُجمَّع، إعداد بأمر واحد)

سكربت الإعداد يولّد `.env` بأسرار **عشوائية قوية** (كلمة مرور Postgres + JWT +
كلمة مرور المدير) ويضبط القاعدة المُجمَّعة تلقائيًّا:

```bash
sh deploy/setup.sh
```

يطبع السكربت **مستخدم وكلمة مرور الدخول** مرّة واحدة — احفظهما. بعدها عدّل
`DOMAIN` و`ACME_EMAIL` فقط في `.env`:

```bash
nano .env   # عدّل DOMAIN=archive.example.com و ACME_EMAIL=you@example.com
```

> يمكنك تغيير كلمة مرور المدير لاحقًا من البرنامج، وتبديل قاعدة البيانات من
> **الإعدادات ← الصيانة ← قاعدة البيانات** (انظر القسم 9).

### بديل: PocketBase أو ضبط يدوي

```bash
cp .env.example .env
nano .env
```
```ini
DOMAIN=archive.example.com
ACME_EMAIL=you@example.com
BACKEND=pocketbase           # أو postgres (مع POSTGRES_PASSWORD قوية)
ARCHIVE_PUBLIC_DEPLOY=1
JWT_SECRET=<openssl rand -base64 48>
ADMIN_PASSWORD=<strong first admin password>
```

## 5. تشغيل الـ stack

```bash
# Postgres المُجمَّع (الموصى — بعد sh deploy/setup.sh)
docker compose -f docker-compose.postgres.yml up -d --build

# أو PocketBase (نسخة احتياطية بملف واحد)
docker compose up -d --build
```

أوّل بناء يستغرق 5-10 دقائق (تنزيل صور + بناء SPA من monorepo + إصدار شهادة TLS).
الـ builds اللاحقة <30 ثانية.

تحقّق:
```bash
docker compose ps                    # كل الحاويات Up
curl -I https://archive.example.com  # 200 OK + شهادة سارية
```

افتح المتصفّح على `https://archive.example.com` — يجب أن تظهر واجهة الأرشيف.

> **إن اخترت PocketBase:** افتح `https://archive.example.com/pb/_/` لإنشاء حساب
> المشرف، ثم استورد المخطّط من `pocketbase/pb_schema.json` (Settings → Import
> collections → الصق المحتوى).

## 6. النسخ الاحتياطي اليومي

شغّل سكريبت النسخ الاحتياطي يوميًّا عبر systemd timer:

```bash
sudo cp deploy/systemd/archive-backup.service /etc/systemd/system/
sudo cp deploy/systemd/archive-backup.timer /etc/systemd/system/
sudo cp deploy/backup-cron.sh /usr/local/bin/archive-backup.sh
sudo chmod +x /usr/local/bin/archive-backup.sh
sudo systemctl daemon-reload
sudo systemctl enable --now archive-backup.timer
# تحقّق
systemctl list-timers archive-backup.timer
```

النسخ تُكتب إلى `/home/archive/backups/` افتراضيًّا — انسخها إلى تخزين خارجي
(S3، Backblaze B2، Hostinger Cloud Storage) عبر `rclone` أو `aws s3 sync`.

## 7. تشغيل تلقائي عند الإقلاع

`restart: unless-stopped` في compose يكفي لإعادة التشغيل بعد إعادة تمهيد VPS،
شرط أن يكون Docker daemon قيد التشغيل (هو كذلك افتراضيًّا بعد التثبيت).

اختبارها يدويًّا:
```bash
sudo reboot
# انتظر 30 ثانية ثم
ssh archive@<VPS_IP>
docker compose ps   # الحاويات Up مجدّدًا
```

## 8. التحديث إلى إصدار جديد

```bash
cd ~/archive-suite
git pull
cd archive-server
docker compose up -d --build --pull
```

ال downtime صفر تقريبًا بفضل ترتيب docker للحاويات.

## 9. تبديل قاعدة البيانات (مُجمَّع ↔ خارجي)

النسخة المُجمَّعة تعمل على Postgres الداخلي افتراضيًّا. للتحويل إلى **خادم SQL
خارجي** (مثل RDS أو Supabase أو خادمك الخاص) دون لمس الملفات:

1. ادخل البرنامج كمدير ← **الإعدادات ← الصيانة ← قاعدة البيانات**.
2. أدخل بيانات الاتصال (رابط كامل أو حقول منفصلة) واضغط **اختبار الاتصال**.
3. اضغط **حفظ** — يُكتب الإعداد في ملف الإعداد الدائم (`server_config` volume،
   `SERVER_CONFIG_PATH`)، **ويتجاوز** `DATABASE_URL` في `.env`.
4. أعد تشغيل الخادم لتطبيق الاتصال الجديد:
   ```bash
   docker compose -f docker-compose.postgres.yml restart server
   ```

الأولوية عند الإقلاع: **ملف الإعداد المحفوظ > `DATABASE_URL` (env) > افتراضي
`POSTGRES_*`**. للعودة إلى المُجمَّع: احذف القيمة المحفوظة (أو أعِد ضبطها إلى
`postgresql://archive:...@postgres:5432/archive`) ثم أعد التشغيل. انقل بياناتك
بين الخادمين عبر تصدير/استيراد اللقطة من «مركز البيانات» (نفس الصيغة).

## استكشاف الأخطاء

| المشكلة | الفحص | الحلّ |
|---------|------|------|
| TLS handshake فشل | `docker compose logs caddy` | تأكّد DNS A record يشير لـ VPS IP قبل بدء caddy، وأنّ منفذ 80 مفتوح للـ HTTP-01 challenge |
| SPA لا يحمّل | `docker compose logs frontend` | غالبًا فشل بناء monorepo — شغّل `pnpm run build:cloud` محليًا وتحقق من Dockerfile.frontend |
| PocketBase لا يستجيب | `docker compose logs pocketbase` | تحقّق صلاحيات `pb_data` volume |
| Postgres لا يبدأ | `docker compose -f docker-compose.postgres.yml logs postgres` | أرجح: `POSTGRES_PASSWORD` فارغ في `.env` |
| نفاد القرص | `df -h` | احذف صور docker القديمة: `docker system prune -a --volumes` (احذر volumes!) |

## التكلفة التقديريّة (Hostinger 2026)

| المكوّن | شهريًّا (USD تقريبًا) |
|---------|----------------------|
| VPS KVM 1 | $5-7 |
| نطاق .com (سنويًّا/12) | $1 |
| **المجموع** | **$6-8/شهر** |

Let's Encrypt مجّاني. لا تكاليف خارجة عن Hostinger.
