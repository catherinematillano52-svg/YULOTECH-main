# SSIS — Student Services Information System (YuloTech)

Self-service portal for students plus Registrar, Cashier, Department (clearance) and Administrator back offices.
Built from the SSIS Figma prototype and the SAD document: **React + Vite** front end, **PHP 8** REST API, **MySQL/MariaDB** database (XAMPP).

## Run it (XAMPP)

1. Start **Apache** and **MySQL** in the XAMPP Control Panel.
2. Create and seed the database (once, and any time you want to reset the demo data):
   ```
   C:\xampp\php\php.exe database\seed.php
   ```
   This creates the `yulotech_ssis` database from `database/schema.sql` and loads demo data.
   DB credentials live in `api/config.php` (default: `root`, no password).
3. Open the built site: <http://localhost/YULOTECH/dist/>
   (rebuild after front-end changes with `npm run build`).

### Development with hot reload
```
npm install
npm run dev        # http://localhost:5173, /api is proxied to http://localhost/YULOTECH
```
No Apache? Run `C:\xampp\php\php.exe -S 127.0.0.1:8000` in this folder and put `SSIS_API=http://127.0.0.1:8000` in `.env.local`.

## Neon Postgres + Realtime
When `DATABASE_URL` is set (environment or `.env.local`, written by `neon deploy`) the PHP API uses Neon Postgres instead of MySQL; set `SSIS_DB_DRIVER=mysql` to force MySQL.
- Enable `extension=pdo_pgsql` in `C:\xampp\php\php.ini` (Apache). For the CLI use `php -d extension=pdo_pgsql -d extension=pgsql database/seed.php`.
- `database/schema.pg.sql` is the Postgres schema; `database/seed.php` loads it plus the demo data (it resets the tables).
- The notification bell is live through Neon Realtime: run `npm run realtime` (seals each user's query; port 8787) next to `npm run dev`, with `VITE_NEON_REALTIME_URL=$NEON_REALTIME_URL` in `.env.local`. Without it the bell polls `/api/notifications`. `node realtime/e2e-check.mjs` checks the flow end to end.
- Allowed browser origins for live queries are listed in `neon.ts` (`neon deploy` applies them).

## Demo accounts
All demo accounts use the password `password123`.

| Portal | Tab | Username |
|---|---|---|
| Student | Student | `carlos` (also `juan`, `sarah`, …) |
| Registrar | Staff | `jobert` |
| Cashier | Staff | `maria` |
| Department (Laboratory office) | Staff | `msantos` |
| Department (other offices) | Staff | `library`, `depthead`, `finance`, `affairs`, `registry` |
| Administrator | Staff | `admin` |

## What's implemented (per the SAD scope)
- **Student**: dashboard, read-only courses, grades, profile + profile-edit request, document requests (Certificate of Enrollment / Grades / Good Moral) with live fee estimate, Pending → Processing → Ready / Rejected tracking with registrar remarks, and clearance progress ("2 of 6 offices cleared"). Requests are blocked while the student has pending library books or an unpaid balance.
- **Registrar**: student records, grade encoding, review of document requests (approve / mark processing / reject — a remark is required to reject) with timeline, and approval of profile-edit requests.
- **Cashier**: student search, balance summary, record Cash / GCash / Bank payments (reference required for GCash/Bank), official receipts (preview / print), daily collections dashboard. No online payment (out of scope).
- **Department**: sequential digital clearance — Library → Laboratory → Department → Finance/Tuition → Student Affairs → Registrar. An office stays *Locked* until the previous office clears the student; Finance cannot clear a student with an unpaid balance.
- **Admin**: create / edit / deactivate accounts, assign roles, reset passwords (temporary password, forced change at next login), password-reset requests, recent activity.
- **Security**: role-based access enforced in the API, password hashing (`password_hash`), session cookies, prepared statements, activity log of sensitive actions.

## Layout
```
api/          PHP REST API (index.php + routes_*.php, lib.php, config.php)
database/     schema.sql (3NF tables) and seed.php (demo data)
src/          React app (pages/ per portal, ui.jsx shared components)
dist/         production build served by Apache
```

---

# Documentation

## 1. Overview
SSIS replaces long school-office lines with a self-service portal. It serves five roles — **Student, Registrar, Cashier, Department, Administrator** — each with its own portal after login. Scope follows the SAD (`Copy of SSIS (SAD).docx`); the UI follows the Figma prototype.

Out of scope (per the SAD): LMS features, enrollment/scheduling, online payments, full accounting, documents other than the three certificates, library/lab management, admissions, e-signatures/QR, and SMS/email notifications (updates appear in the in-app bell only).

## 2. Architecture
```
Browser (React SPA, hash routing)  ──fetch JSON──►  PHP API (api/index.php/<route>)  ──PDO──►  MySQL (yulotech_ssis)
```
- **Front end** – React 19 + Vite. `src/App.jsx` (session + router), `src/Shell.jsx` (sidebar/topbar/notifications), `src/pages/*` (one file per portal), `src/ui.jsx` (shared components), `src/api.js` (fetch client + formatters), `src/index.css` (design tokens and styles).
- **API** – plain PHP 8, no framework. `api/index.php` routes by `PATH_INFO` to `routes_<portal>.php`; `lib.php` holds the DB connection, JSON helpers, auth guards and activity log; `config.php` holds settings.
- **Database** – MySQL/MariaDB, schema in `database/schema.sql`, demo data in `database/seed.php`.

## 3. Database design (3NF)
| Table | Purpose |
|---|---|
| `users` | Accounts: username, hashed password, role, unit/office, status, `must_change_password` |
| `students` | Student profile linked to a user (`user_id`), program, year, contact details |
| `subjects`, `enrollments` | Subject catalogue; a student's schedule and final grade per term |
| `student_balances`, `payments` | Fees owed/paid; each payment with method, reference, OR number, cashier |
| `document_requests`, `request_timeline` | Certificate requests, status and registrar remarks; per-request history |
| `profile_edit_requests` | Student-submitted profile changes awaiting Registrar approval |
| `clearance_steps` | One row per student per office (steps 1–6) with status and remarks |
| `password_reset_requests` | Reset requests shown to the Admin |
| `announcements`, `notifications` | Dashboard announcements; per-user in-app bell |
| `activity_log` | Audit trail of sensitive actions |

Key relationships: `students.user_id → users.id`; `enrollments → students, subjects`; `payments → students, users (cashier)`; `document_requests → students`; `request_timeline → document_requests`; `clearance_steps → students`.

## 4. Business rules
- **Document fee** = copies × ₱50 (+ ₱100 if *Delivery*). Values are in `api/config.php`.
- **Request blocking** – a student with pending library books or an unpaid balance cannot submit a request.
- **Request statuses** – Pending → Processing → Ready, or Rejected (a registrar remark is required to reject; students see it).
- **Clearance order** – Library → Laboratory → Department → Finance/Tuition → Student Affairs → Registrar. An office can only clear a student once all earlier offices have; later steps show as *Locked*. Finance cannot clear a student who still owes a balance.
- **Payments** – Cash, GCash or Bank Transfer; reference number required for GCash/Bank; amount cannot exceed the balance due; each payment issues an OR number (`OR-<year>-<student>-<n>`).
- **Grades** – 1.00–5.00; ≤ 3.00 is *Passed*. GWA is unit-weighted.
- **Accounts** – admin-created accounts get a temporary password and must change it at first login; admins cannot deactivate themselves.

## 5. API reference
Base URL: `/YULOTECH/api/index.php`. JSON in/out; session cookie auth; errors return `{ "error": "message" }` with an HTTP status (401 not signed in, 403 wrong role, 404, 409 rule conflict, 422/400 validation).

| Area | Endpoints |
|---|---|
| Auth | `POST /login` `POST /logout` `GET /me` `POST /forgot` `POST /password` `GET /notifications` `POST /notifications/read` |
| Student | `GET /student/dashboard` `/courses` `/grades` `/profile` `/documents` `/clearance` · `POST /student/profile-edit` `POST /student/documents` |
| Registrar | `GET /registrar/dashboard` `/students` `/students/:id` `/grades/:id` `/requests` `/requests/:id` · `PUT /registrar/students/:id` `PUT /registrar/grades/:id` · `POST /registrar/requests/:id/action` (`approve`\|`processing`\|`reject`) `POST /registrar/profile-edits/:id` |
| Cashier | `GET /cashier/dashboard` `/students?q=` `/receipts` `/receipts/:or` · `POST /cashier/payments` |
| Department | `GET /department/dashboard` `/clearance` · `POST /department/clearance/:studentId` (`clear`\|`hold`) `POST /department/clearance` (add student) |
| Admin | `GET /admin/dashboard` `/users` · `POST /admin/users` `PUT /admin/users/:id` `POST /admin/users/:id/status` `POST /admin/users/:id/reset` |

List endpoints accept `q`, `page`, `per` and portal-specific filters (`role`, `status`, `program`, `year`, `type`, `range`, `course`).

## 6. Security
- Passwords hashed with `password_hash()` (bcrypt); verified with `password_verify()`.
- Role checks on every endpoint (`requireRole`), so URLs cannot be used to reach another portal.
- All SQL uses prepared statements; session ID regenerated at login; HttpOnly + SameSite cookie.
- Login/forgot-password responses do not reveal whether a username exists.
- Sensitive actions (sign-in, payments, grade changes, clearance, account changes) are written to `activity_log`.
- Before real deployment: change the MySQL `root` password and set `SSIS_DB_*` environment variables, serve over HTTPS, and delete the demo accounts.

## 7. Configuration
`api/config.php` – DB host/port/name/user/password (or `SSIS_DB_HOST`, `SSIS_DB_PORT`, `SSIS_DB_NAME`, `SSIS_DB_USER`, `SSIS_DB_PASS`), document fees, current term, and the ordered clearance offices.

## 8. Commands
| Command | What it does |
|---|---|
| `npm install` | Install front-end dependencies |
| `npm run dev` | Dev server with hot reload (proxies `/api`) |
| `npm run build` | Build to `dist/` for Apache |
| `npm run lint` | Lint with oxlint |
| `php database/seed.php` | (Re)create and seed the database |

## 9. Troubleshooting
- **"Cannot reach the server"** – Apache isn't running, or the site isn't under `htdocs/YULOTECH`.
- **"Database error"** – MySQL isn't running or the seed hasn't been run; check `api/config.php`.
- **Blank page after moving the folder** – the build uses relative paths; open `…/YULOTECH/dist/` and keep `api/` next to `dist/`.
- **Dev proxy errors** – start Apache, or use `php -S 127.0.0.1:8000` with `SSIS_API` in `.env.local`.

## 10. Team (from the SAD)
Trisha Anne E. Panganiban (Product Owner / Team Leader) · Catherine Matillano (Scrum Master) · Myco Reggie S. Dado (Front End) · Ricky B. Rosario Jr. (Back End) · John Brian S. Lorena (Database) · Bryan M. Regalado (Document / QA).
