# FILTERNET — پنل اشتراک کانفیگ V2Ray

سایت اشتراک‌گذاری کانفیگ روی **Cloudflare Pages + D1** (دیتابیس `vpo`).

- پنل عمومی: `https://playneofly.ir/` — لیست سرورها + کپی + QR
- پنل ادمین: `https://playneofly.ir/admin9831` — مدیریت سرورها با رمز عبور

---

## ساختار فایل‌ها

```
playneofly/
├── index.html                  → صفحه اصلی (لوگو و کتابخانه QR داخلش تعبیه شده)
├── admin9831.html              → پنل ادمین
├── _redirects                  → مسیردهی /admin9831
├── schema.sql                  → اسکیمای دیتابیس
├── functions/
│   ├── api/servers.js          → GET لیست سرورهای فعال (عمومی)
│   └── api/admin/
│       ├── login.js            → POST ورود + ست کوکی
│       ├── logout.js           → POST خروج
│       ├── check.js            → GET بررسی لاگین
│       ├── servers.js          → GET/POST لیست کامل + افزودن
│       └── servers/[id].js     → POST/DELETE ویرایش/تغییر وضعیت/حذف
```

---

## ⚠️ مهم: تنظیمات بیلد در Cloudflare Pages

وقتی پروژه Pages رو به گیتهاب وصل می‌کنی، در صفحه **Set up builds and deployments** این مقادیر رو دقیقاً همین‌طوری بذار:

| تنظیم | مقدار |
|---|---|
| Production branch | `main` (باید با شاخه پیش‌فرض ریپوی گیتهاب یکی باشه) |
| Framework preset | **None** |
| Build command | `exit 0` |
| Build output directory | `/` |

> 🔴 این سه تا (None / exit 0 / /) حیاتی‌ان. اگه Build command خالی بمونه یا کلادفلر خودش فریم‌ورکی تشخیص بده، دیپلوی با خطا می‌خوره.

---

## مراحل کامل راه‌اندازی

### ۱) آپلود به گیتهاب
1. فایل ZIP را Extract کن و **داخل پوشه‌ای که باز شده** (جایی که `index.html` و پوشه `functions` قرار دارن) دستورها را بزن:
```bash
git init
git add .
git commit -m "FILTERNET"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```
2. **چک کن** که `index.html` در **ریشه** ریپو باشه (نه داخل یک زیرپوشه).

### ۲) ساخت دیتابیس D1
1. داشبورد Cloudflare → **Workers & Pages → D1 → Create database**
2. اسمش را بذار `vpo` و Create کن
3. روی دیتابیس کلیک کن → تب **Console** → محتوای فایل `schema.sql` را کپی کن، داخل کادر paste کن و **Execute** بزن

### ۳) ساخت پروژه Pages
1. **Workers & Pages → Create → Pages → Connect to Git**
2. ریپوی گیتهاب را انتخاب کن
3. تنظیمات بیلد را طبق جدول بالا بذار (None / `exit 0` / `/`)
4. **Save and Deploy**

### ۴) اتصال دیتابیس و رمز عبور
در صفحه پروژه Pages → تب **Settings**:
- بخش **Functions → D1 database bindings → Add binding**
  - Variable name: `VPO`
  - Database: `vpo`
- بخش **Environment variables → Add variable**
  - نام: `ADMIN_PASSWORD` — مقدار: رمز دلخواهت برای پنل ادمین

بعد از هر تغییر، یک commit جدید push کن تا خودکار دیپلوی بشه.

---

## اگر دیپلوی خطا داد (Cloudflare Pages - Deploying)

1. **تنظیمات بیلد را چک کن** — شایع‌ترین علت: Build command خالی یا فریم‌ورک اشتباه. باید `None` + `exit 0` + `/` باشه.
2. **شاخه (branch) را چک کن** — اگر شاخه گیتهاب `master` است و در کلادفلر `main` ست شده، تغییرش بده.
3. **ریشه ریپو را چک کن** — `index.html` باید مستقیماً در ریشه باشد.
4. روی دیپلوی ناموفق کلیک کن → **View build log** → خط آخر را ببین (نه «All checks have failed» توی گیتهاب).
5. اگر بازم نشد، از پروژه Pages بزن **Deployments → Retry deployment**.

---

## نکات

- **پسورد ادمین** هرگز توی کد یا گیتهاب نذار؛ فقط توی Environment Variables کلادفلر.
- کوکی لاگین ۷ روز اعتبار داره و با `HttpOnly` ست می‌شه.
- سرورهای غیرفعال توی سایت عمومی نمایش داده نمی‌شن.
- لوگو به‌صورت data URI داخل HTML جاسازی شده؛ هیچ فایل عکسی برای دانلود وجود نداره.
- برای تغییر آدرس پنل ادمین: اسم فایل `admin9831.html` و خط مربوطه در `_redirects` را با هم عوض کن.
