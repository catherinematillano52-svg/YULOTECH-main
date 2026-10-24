-- SSIS (Student Services Information System) - 3NF schema for Postgres (Neon).
-- Same tables as schema.sql (MySQL). Timestamps are Manila local time, matching the MySQL setup.
DROP TABLE IF EXISTS notifications, activity_log, password_reset_requests, profile_edit_requests,
  request_timeline, document_requests, payments, student_balances, clearance_steps,
  enrollments, subjects, announcements, students, users CASCADE;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(60) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(12) NOT NULL CHECK (role IN ('student','registrar','cashier','department','admin')),
  unit VARCHAR(80) NULL,
  status VARCHAR(8) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  must_change_password SMALLINT NOT NULL DEFAULT 0,
  last_login TIMESTAMP(0) NULL,
  created_at TIMESTAMP(0) NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Manila')
);

CREATE TABLE students (
  id SERIAL PRIMARY KEY,
  user_id INT NULL UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  student_no VARCHAR(20) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  program VARCHAR(20) NOT NULL,
  program_name VARCHAR(120) NOT NULL,
  year_level SMALLINT NOT NULL,
  section VARCHAR(20) NULL,
  enrollment_status VARCHAR(10) NOT NULL DEFAULT 'Enrolled' CHECK (enrollment_status IN ('Enrolled','On Leave','Pending')),
  email VARCHAR(120) NULL,
  contact VARCHAR(30) NULL,
  birth_date DATE NULL,
  gender VARCHAR(20) NULL,
  civil_status VARCHAR(20) NULL,
  address VARCHAR(255) NULL,
  pending_library_books INT NOT NULL DEFAULT 0
);

CREATE TABLE subjects (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  title VARCHAR(120) NOT NULL,
  units SMALLINT NOT NULL DEFAULT 3
);

CREATE TABLE enrollments (
  id SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id INT NOT NULL REFERENCES subjects(id),
  instructor VARCHAR(80) NOT NULL,
  room VARCHAR(40) NOT NULL,
  days VARCHAR(10) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  grade NUMERIC(3,2) NULL,
  term VARCHAR(30) NOT NULL DEFAULT '1st Semester, A.Y. 2026-2027',
  CONSTRAINT uq_enroll UNIQUE (student_id, subject_id, term)
);

CREATE TABLE student_balances (
  student_id INT PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  total_fees NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0
);

CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  txn_ref VARCHAR(20) NOT NULL UNIQUE,
  or_number VARCHAR(30) NULL UNIQUE,
  student_id INT NOT NULL REFERENCES students(id),
  cashier_id INT NOT NULL REFERENCES users(id),
  fee_type VARCHAR(60) NOT NULL,
  method VARCHAR(14) NOT NULL CHECK (method IN ('Cash','GCash','Bank Transfer')),
  reference_no VARCHAR(60) NULL,
  amount NUMERIC(10,2) NOT NULL,
  status VARCHAR(7) NOT NULL DEFAULT 'Paid' CHECK (status IN ('Paid','Pending','Failed')),
  paid_at TIMESTAMP(0) NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Manila')
);

CREATE TABLE document_requests (
  id SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  doc_type VARCHAR(30) NOT NULL CHECK (doc_type IN ('Certificate of Enrollment','Certificate of Grades','Certificate of Good Moral')),
  purpose VARCHAR(60) NOT NULL,
  delivery_method VARCHAR(14) NOT NULL CHECK (delivery_method IN ('Campus Pickup','Delivery')),
  copies SMALLINT NOT NULL DEFAULT 1,
  date_needed DATE NOT NULL,
  remarks_student VARCHAR(500) NULL,
  fee NUMERIC(8,2) NOT NULL DEFAULT 0,
  status VARCHAR(10) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Processing','Ready','Rejected')),
  registrar_remarks VARCHAR(500) NULL,
  created_at TIMESTAMP(0) NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Manila')
);

CREATE TABLE request_timeline (
  id SERIAL PRIMARY KEY,
  request_id INT NOT NULL REFERENCES document_requests(id) ON DELETE CASCADE,
  label VARCHAR(80) NOT NULL,
  detail VARCHAR(255) NULL,
  created_at TIMESTAMP(0) NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Manila')
);

CREATE TABLE profile_edit_requests (
  id SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  full_name VARCHAR(120), email VARCHAR(120), contact VARCHAR(30),
  birth_date DATE NULL, gender VARCHAR(20), civil_status VARCHAR(20), address VARCHAR(255),
  reason VARCHAR(500) NOT NULL,
  status VARCHAR(8) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
  created_at TIMESTAMP(0) NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Manila')
);

-- Sequential clearance: step 1 Library ... step 6 Registrar
CREATE TABLE clearance_steps (
  id SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  step SMALLINT NOT NULL,
  office VARCHAR(40) NOT NULL,
  status VARCHAR(8) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Cleared','On Hold')),
  remarks VARCHAR(255) NULL,
  updated_by INT NULL,
  updated_at TIMESTAMP(0) NULL,
  CONSTRAINT uq_clear UNIQUE (student_id, step)
);

CREATE TABLE password_reset_requests (
  id SERIAL PRIMARY KEY,
  username VARCHAR(60) NOT NULL,
  status VARCHAR(7) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Done')),
  created_at TIMESTAMP(0) NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Manila')
);

CREATE TABLE announcements (
  id SERIAL PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  body VARCHAR(255) NOT NULL,
  tag VARCHAR(30) NOT NULL,
  posted_on DATE NOT NULL
);

CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message VARCHAR(255) NOT NULL,
  is_read SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP(0) NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Manila')
);

CREATE TABLE activity_log (
  id SERIAL PRIMARY KEY,
  user_id INT NULL REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(255) NOT NULL,
  created_at TIMESTAMP(0) NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Manila')
);
