# FILTERNET — پنل اشتراک کانفیگ V2Ray

سایت اشتراک‌گذاری کانفیگ روی **Cloudflare Pages + D1** (دیتابیس `vpo`).

- پنل عمومی: `https://playneofly.ir/` — لیست سرورها + کپی + QR
- پنل ادمین: `https://playneofly.ir/admin9831` — مدیریت سرورها با رمز عبور

---

## ساختار فایل‌ها

```
playneofly/
├── index.html                  → صفحه عمومی (لوگو و کتابخانه QR به‌صورت inline داخلش تعبیه شده)
├── admin9831.html              → پنل ادمین (لوگو inline)
├── _redirects                  → روت /admin9831 به admin9831.html
├── schema.sql                  → اسکیمای دیتابیس
├── wrangler.toml               → کانفیگ Wrangler (D1 binding: VPO)
├── functions/
│   ├── api/servers.js          → GET لیست سرورهای فعال (عمومی)
│   └── api/admin/
│       ├── login.js            → POST ورود + ست کوکی
│       ├── logout.js           → POST خروج
│       ├── check.js            → GET بررسی لاگین
│       ├── servers.js          → GET/POST لیست کامل + افزودن
│       └── servers/[id].js     → POST/DELETE ویرایش/تغییر وضعیت/حذف
└── preview/server.js           → سرور تست محلی (نیازی به آپلود نیست)
```

---

## مراحل راه‌اندازی روی Cloudflare

### ۱) ساخت دیتابیس D1
در داشبورد Cloudflare → بخش **Workers & Pages → D1**:
- دکمه **Create database** → اسمش رو بذار `vpo`
- بعد از ساخت، **Database ID** رو کپی کن و توی `wrangler.toml` بذار (جای `REPLACE_WITH_YOUR_D1_DATABASE_ID`)
- جدول‌ها رو بساز. با Wrangler:

```bash
npm install -g wrangler
wrangler d1 execute vpo --remote --file=schema.sql
```

یا از تب Console خود دیتابیس توی داشبورد، محتوای `schema.sql` رو paste و Run کن.

### ۲) ساخت پروژه Pages
- داشبورد → **Workers & Pages → Create → Pages**
- گزینه **Connect to Git** → ریپوی گیتهاب خودت رو انتخاب کن
- Build settings:
  - Framework preset: **None**
  - Build command: خالی بذار (فایل‌ها آماده‌ان)
  - Build output directory: `/` (ریشه)
- **Save and Deploy**

### ۳) اتصال دیتابیس (Binding)
در صفحه پروژه Pages → تب **Settings → Functions**:
- بخش **D1 database bindings** → **Add binding**
  - Variable name: `VPO`
  - Database: `vpo`

### ۴) متغیرهای محیطی
در همان تب Settings → **Environment variables**:

| نام متغیر | مقدار | توضیح |
|---|---|---|
| `ADMIN_PASSWORD` | رمز دلخواهت | رمز ورود پنل ادمین (اجباری) |

> ⚠️ این متغیر فقط روی کلادفلر تنظیم می‌شه و **توی گیتهاب آپلود نمی‌شه**.

### ۵) گیتهاب و دیپلوی خودکار
```bash
git init
git add .
git commit -m "پنل FILTERNET"
git remote add origin https://github.com/USERNAME/playneofly.git
git push -u origin main
```
بعد از هر push، کلادفلر خودکار دیپلوی می‌کنه. ✅

---

## تست محلی (قبل از آپلود)

```bash
cd playneofly
node preview/server.js
# سپس:
#   http://localhost:8787/          → پنل عمومی
#   http://localhost:8787/admin9831 → ادمین (رمز پیش‌فرض: admin9831)
# تغییر رمز: ADMIN_PASSWORD=123 node preview/server.js
```

---

## نکات

- **پسورد ادمین** هرگز توی کد یا گیتهاب نذار؛ فقط توی Environment Variables کلادفلر.
- کوکی لاگین ۷ روز اعتبار داره و با `HttpOnly` ست می‌شه.
- سرورهای غیرفعال توی سایت عمومی نمایش داده نمی‌شن.
- هیچ کانفیگ پیش‌فرضی وجود نداره؛ همه سرورها رو خودت از پنل ادمین اضافه می‌کنی.
- لوگو و آیکون سایت به‌صورت data URI داخل HTML جاسازی شده؛ هیچ فایل عکسی در پروژه وجود نداره که قابل دانلود باشه.
- برای تعویض لوگو: عکس جدید رو base64 کن و مقدار `src="data:image/png;base64,..."` و `href` فاوآیکون رو در `index.html` و `admin9831.html` جایگزین کن.
- برای تغییر آدرس پنل ادمین: اسم فایل `admin9831.html` و خط مربوطه در `_redirects` رو با هم عوض کن.
