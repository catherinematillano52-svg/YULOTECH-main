-- SSIS (Student Services Information System) - 3NF schema
CREATE DATABASE IF NOT EXISTS yulotech_ssis CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE yulotech_ssis;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS notifications, activity_log, password_reset_requests, profile_edit_requests,
  request_timeline, document_requests, payments, student_balances, clearance_steps,
  enrollments, subjects, announcements, students, users;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(60) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('student','registrar','cashier','department','admin') NOT NULL,
  unit VARCHAR(80) NULL COMMENT 'Grade/Dept label, or clearance office for department staff',
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  last_login DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL UNIQUE,
  student_no VARCHAR(20) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  program VARCHAR(20) NOT NULL,
  program_name VARCHAR(120) NOT NULL,
  year_level TINYINT NOT NULL,
  section VARCHAR(20) NULL,
  enrollment_status ENUM('Enrolled','On Leave','Pending') NOT NULL DEFAULT 'Enrolled',
  email VARCHAR(120) NULL,
  contact VARCHAR(30) NULL,
  birth_date DATE NULL,
  gender VARCHAR(20) NULL,
  civil_status VARCHAR(20) NULL,
  address VARCHAR(255) NULL,
  pending_library_books INT NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  title VARCHAR(120) NOT NULL,
  units TINYINT NOT NULL DEFAULT 3
) ENGINE=InnoDB;

CREATE TABLE enrollments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  subject_id INT NOT NULL,
  instructor VARCHAR(80) NOT NULL,
  room VARCHAR(40) NOT NULL,
  days VARCHAR(10) NOT NULL COMMENT 'e.g. MWF, TTH',
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  grade DECIMAL(3,2) NULL,
  term VARCHAR(30) NOT NULL DEFAULT '1st Semester, A.Y. 2026-2027',
  UNIQUE KEY uq_enroll (student_id, subject_id, term),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id)
) ENGINE=InnoDB;

CREATE TABLE student_balances (
  student_id INT PRIMARY KEY,
  total_fees DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  txn_ref VARCHAR(20) NOT NULL UNIQUE,
  or_number VARCHAR(30) NULL UNIQUE,
  student_id INT NOT NULL,
  cashier_id INT NOT NULL,
  fee_type VARCHAR(60) NOT NULL,
  method ENUM('Cash','GCash','Bank Transfer') NOT NULL,
  reference_no VARCHAR(60) NULL,
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('Paid','Pending','Failed') NOT NULL DEFAULT 'Paid',
  paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (cashier_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE document_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  doc_type ENUM('Certificate of Enrollment','Certificate of Grades','Certificate of Good Moral') NOT NULL,
  purpose VARCHAR(60) NOT NULL,
  delivery_method ENUM('Campus Pickup','Delivery') NOT NULL,
  copies TINYINT NOT NULL DEFAULT 1,
  date_needed DATE NOT NULL,
  remarks_student VARCHAR(500) NULL,
  fee DECIMAL(8,2) NOT NULL DEFAULT 0,
  status ENUM('Pending','Processing','Ready','Rejected') NOT NULL DEFAULT 'Pending',
  registrar_remarks VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE request_timeline (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  label VARCHAR(80) NOT NULL,
  detail VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES document_requests(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE profile_edit_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  full_name VARCHAR(120), email VARCHAR(120), contact VARCHAR(30),
  birth_date DATE NULL, gender VARCHAR(20), civil_status VARCHAR(20), address VARCHAR(255),
  reason VARCHAR(500) NOT NULL,
  status ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Sequential clearance: step 1 Library ... step 6 Registrar
CREATE TABLE clearance_steps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  step TINYINT NOT NULL,
  office VARCHAR(40) NOT NULL,
  status ENUM('Pending','Cleared','On Hold') NOT NULL DEFAULT 'Pending',
  remarks VARCHAR(255) NULL,
  updated_by INT NULL,
  updated_at DATETIME NULL,
  UNIQUE KEY uq_clear (student_id, step),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE password_reset_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(60) NOT NULL,
  status ENUM('Pending','Done') NOT NULL DEFAULT 'Pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE announcements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  body VARCHAR(255) NOT NULL,
  tag VARCHAR(30) NOT NULL,
  posted_on DATE NOT NULL
) ENGINE=InnoDB;

CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  message VARCHAR(255) NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE activity_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
