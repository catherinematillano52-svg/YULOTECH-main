<?php
date_default_timezone_set('Asia/Manila');
// Usage: php database/seed.php   (creates the schema and loads demo data)
// Seeds Neon Postgres when DATABASE_URL is set (env or .env.local), otherwise local MySQL (yulotech_ssis).
require __DIR__ . '/../api/lib.php';
$pg = isPg();
if ($pg) {
    // PHP's CLI may not load pdo_pgsql by default: php -d extension=pdo_pgsql database/seed.php
    $pdo = connectPg(envValue('DATABASE_URL_UNPOOLED') ?: cfg('database_url'));
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec(file_get_contents(__DIR__ . '/schema.pg.sql'));
} else {
    $cfg = require __DIR__ . '/../api/config.php';
    $pdo = new PDO("mysql:host={$cfg['db_host']};port={$cfg['db_port']};charset=utf8mb4", $cfg['db_user'], $cfg['db_pass'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $pdo->exec(file_get_contents(__DIR__ . '/schema.sql'));
    $pdo->exec('USE ' . $cfg['db_name']);
    $pdo->exec("SET time_zone = '+08:00'");
}
$cfg = require __DIR__ . '/../api/config.php';

const PASSWORD = 'password123';
$hash = password_hash(PASSWORD, PASSWORD_DEFAULT);
$offices = $cfg['offices'];

function ins(PDO $p, string $t, array $row): int {
    $cols = implode(',', array_keys($row));
    $ph = implode(',', array_fill(0, count($row), '?'));
    global $pg;
    $p->prepare("INSERT INTO $t ($cols) VALUES ($ph)")->execute(array_values($row));
    // student_balances is keyed by student_id and has no id sequence
    return $pg ? ($t === 'student_balances' ? 0 : (int)$p->lastInsertId($t . '_id_seq')) : (int)$p->lastInsertId();
}
$ago = fn(string $s) => date('Y-m-d H:i:s', strtotime("-$s"));

// ---- Staff accounts
$staff = [
  ['admin',     'Irene Mabalot',   'admin@ssis.edu',       'admin',      'IT Support'],
  ['admin2',    'James Doe',       'james.doe@ssis.edu',   'admin',      'IT Support'],
  ['jobert',    'Jobert Alcasid',  'jobert@ssis.edu',      'registrar',  'Registrar Department'],
  ['registrar2','Michael Ross',    'michael.ross@ssis.edu','registrar',  'Registrar Department'],
  ['maria',     'Maria Dela Cruz', 'maria.dc@ssis.edu',    'cashier',    'Cashier'],
  ['cashier2',  'Ana Reyes',       'ana.reyes@ssis.edu',   'cashier',    'Cashier'],
  ['msantos',   'Maria Santos',    'maria.santos@ssis.edu','department', 'Laboratory'],
  ['library',   'Daniel Lee',      'daniel.lee@ssis.edu',  'department', 'Library'],
  ['depthead',  'Paolo Garcia',    'paolo.garcia@ssis.edu','department', 'Department'],
  ['finance',   'Liza Bautista',   'liza.bautista@ssis.edu','department','Finance / Tuition'],
  ['affairs',   'Ramon Torres',    'ramon.torres@ssis.edu','department', 'Student Affairs'],
  ['registry',  'Grace Villanueva','grace.v@ssis.edu',     'department', 'Registrar'],
];
$uid = [];
foreach ($staff as [$u, $n, $e, $r, $unit]) {
    $uid[$u] = ins($pdo, 'users', ['username'=>$u,'full_name'=>$n,'email'=>$e,'password_hash'=>$hash,'role'=>$r,'unit'=>$unit,
        'last_login'=>$ago('2 hours'),'created_at'=>$ago('30 days')]);
}

// ---- Subjects
$subjects = [
  ['CS101','Introduction to Computing',3],['MATH201','Calculus II',3],['ENG210','Technical Writing',3],
  ['PE001','Physical Education',2],['CS201','Data Structures',3],['CS102','Data Structures and Algorithms',3],
  ['IT201','Database Management Systems',3],['MATH202','Discrete Mathematics',3],['GE105','Purposive Communication',3],
];
$sid = [];
foreach ($subjects as [$c,$t,$u]) $sid[$c] = ins($pdo,'subjects',['code'=>$c,'title'=>$t,'units'=>$u]);

// ---- Students
$progs = [
  'BSIT'=>'Bachelor of Science in Information Technology','BSCS'=>'Bachelor of Science in Computer Science',
  'BSIS'=>'Bachelor of Science in Information Systems','BSCpE'=>'Bachelor of Science in Computer Engineering',
  'BSA'=>'Bachelor of Science in Accountancy',
];
// username, name, student no, program, year, gender, civil, dob, contact, address, offices cleared
$students = [
  ['carlos','Carlos Edriel Yulo','2022-00123','BSIT',3,'Male','Single','2003-11-02','+63 912 345 6789','123 Rizal Street, Barangay San Jose, Manila, Metro Manila',2],
  ['juan','Juan Dela Cruz','2023-00418','BSA',3,'Male','Single','2004-02-11','+63 917 111 2233','45 Mabini St., Cabuyao, Laguna',0],
  ['sarah','Sarah Jenkins','2023-00520','BSIT',3,'Female','Single','2004-06-20','+63 918 222 3344','Calamba, Laguna',0],
  ['maria.a','Maria Angelica Santos','2021-00145','BSIT',4,'Female','Single','2002-04-05','+63 915 000 1111','Santa Rosa, Laguna',6],
  ['john','John Paul Reyes','2022-00217','BSCS',3,'Male','Single','2003-01-19','+63 916 333 4455','Binan, Laguna',6],
  ['katrina','Katrina Mae Dela Cruz','2022-00238','BSIS',3,'Female','Single','2003-08-30','+63 917 555 6677','San Pedro, Laguna',1],
  ['miguel','Miguel Antonio Ramos','2023-00316','BSIT',2,'Male','Single','2004-12-01','+63 919 777 8899','Cabuyao, Laguna',2],
  ['sofia.g','Sofia Isabel Garcia','2023-00342','BSCS',2,'Female','Single','2004-03-14','+63 920 123 4567','Calamba, Laguna',3],
  ['joshua','Joshua Daniel Bautista','2024-00415','BSIS',1,'Male','Single','2005-09-09','+63 921 234 5678','Los Banos, Laguna',0],
  ['maria.s','Maria Santiago','2021-00456','BSCS',4,'Female','Single','2002-05-23','+63 922 345 6789','Cabuyao, Laguna',1],
  ['jose','Jose Rizal','2021-00789','BSIS',4,'Male','Single','2002-06-19','+63 923 456 7890','Calamba, Laguna',2],
  ['ana','Ana Reyes','2022-00101','BSCpE',3,'Female','Single','2003-02-27','+63 924 567 8901','Binan, Laguna',6],
  ['miguel.d','Miguel dela Cruz','2022-00202','BSIT',3,'Male','Single','2003-07-07','+63 925 678 9012','San Pedro, Laguna',0],
  ['sofia.l','Sofia Lim','2022-00303','BSCS',3,'Female','Single','2003-10-10','+63 926 789 0123','Cabuyao, Laguna',1],
  ['rafael','Rafael Aquino','2022-00404','BSIS',3,'Male','Single','2003-12-25','+63 927 890 1234','Calamba, Laguna',0],
  ['isabella','Isabella Torres','2023-00501','BSCpE',2,'Female','Single','2004-01-30','+63 928 901 2345','Los Banos, Laguna',6],
  ['andres','Andres Bonifacio','2023-00602','BSIT',2,'Male','Single','2004-11-30','+63 929 012 3456','Cabuyao, Laguna',1],
  ['emily','Emily Wilson','2024-00700','BSCS',2,'Female','Single','2004-04-04','+63 930 123 4567','Calamba, Laguna',0],
  ['olivia','Olivia Martin','2024-00701','BSIT',1,'Female','Single','2005-05-05','+63 931 234 5678','Binan, Laguna',0],
  ['mark','Mark Santos','2024-00951','BSIT',1,'Male','Single','2005-08-08','+63 932 345 6789','Cabuyao, Laguna',0],
];
$holds = ['maria.s'=>[2,'Unreturned laboratory equipment'], 'sofia.l'=>[2,'Pending laboratory requirements'], 'andres'=>[2,'Laboratory fee unsettled']];
$stid = [];
foreach ($students as $i => [$u,$n,$no,$pg,$yr,$g,$cs,$dob,$ct,$ad,$cleared]) {
    $email = $u === 'carlos' ? 'carlos.yulo@school.edu.ph' : strtolower(str_replace(' ', '.', $n)) . '@school.edu.ph';
    $userId = ins($pdo,'users',['username'=>$u,'full_name'=>$n,'email'=>$email,'password_hash'=>$hash,'role'=>'student',
        'unit'=>"$pg, Year $yr",'last_login'=>$i<3?$ago('1 day'):null,'created_at'=>$ago(($i*3+2).' hours')]);
    $s = ins($pdo,'students',['user_id'=>$userId,'student_no'=>$no,'full_name'=>$n,'program'=>$pg,'program_name'=>$progs[$pg],
        'year_level'=>$yr,'section'=>"$pg {$yr}A",
        'enrollment_status'=>$no==='2022-00238'?'On Leave':($no==='2024-00415'?'Pending':'Enrolled'),
        'email'=>$email,'contact'=>$ct,'birth_date'=>$dob,'gender'=>$g,'civil_status'=>$cs,'address'=>$ad,
        'pending_library_books'=>$no==='2022-00404'?2:0]);
    $stid[$u] = $s;
    $paid = $u==='juan' ? 32000 : ($i%5===4 && $u!=='rafael' ? 30000 : 42500);
    if ($u==='rafael') $paid = 42500;
    ins($pdo,'student_balances',['student_id'=>$s,'total_fees'=>42500,'amount_paid'=>$paid]);
    for ($k = 1; $k <= 6; $k++) {
        $st = $k <= $cleared ? 'Cleared' : 'Pending'; $rm = null;
        if ($st === 'Cleared') $rm = [1=>'No outstanding books or fines',2=>'No pending laboratory requirements'][$k] ?? 'Cleared';
        if (isset($holds[$u]) && $holds[$u][0] === $k) { $st = 'On Hold'; $rm = $holds[$u][1]; }
        ins($pdo,'clearance_steps',['student_id'=>$s,'step'=>$k,'office'=>$offices[$k-1],'status'=>$st,'remarks'=>$rm,
            'updated_at'=>$st==='Pending'?null:$ago('3 hours')]);
    }
}

// ---- Enrollments + grades
$sched = [
  ['CS101','Prof. Santos','Lab 1','MWF','07:30','08:30',2.25],
  ['MATH201','Prof. Reyes','Rm 204','TTH','09:00','10:30',2.00],
  ['ENG210','Prof. Cruz','Rm 101','MWF','10:30','11:30',1.25],
  ['PE001','Coach Dela Rosa','Gym','WF','13:00','14:30',2.00],
  ['CS201','Prof. Lim','Lab 2','TTH','13:00','14:30',3.00],
];
foreach ($sched as [$c,$in,$rm,$d,$s,$e,$g])
    ins($pdo,'enrollments',['student_id'=>$stid['carlos'],'subject_id'=>$sid[$c],'instructor'=>$in,'room'=>$rm,'days'=>$d,'start_time'=>$s,'end_time'=>$e,'grade'=>$g]);
$others = ['CS102','IT201','MATH202','GE105'];
foreach ($stid as $u => $s) {
    if ($u === 'carlos') continue;
    foreach ($others as $j => $c)
        ins($pdo,'enrollments',['student_id'=>$s,'subject_id'=>$sid[$c],'instructor'=>'Prof. Santos','room'=>'Rm '.(101+$j),
            'days'=>$j%2?'TTH':'MWF','start_time'=>sprintf('%02d:00',8+$j*2),'end_time'=>sprintf('%02d:30',9+$j*2),
            'grade'=>[1.5,1.75,1.25,2.0][$j]]);
}

// ---- Payments (Maria Dela Cruz is the demo cashier)
$pay = [
 ['TXN-0841','OR-2026-00418-01','juan','Tuition - 1st Sem','GCash',12500,'Paid','08:14'],
 ['TXN-0840','OR-2026-00417-01','ana','Misc. Fees','Cash',3200,'Paid','08:02'],
 ['TXN-0839','OR-2026-00416-01','mark','Laboratory Fee','Cash',1800,'Paid','07:55'],
 ['TXN-0838',null,'sofia.l','Tuition - Installment','Bank Transfer',8000,'Pending','07:41'],
 ['TXN-0837','OR-2026-00414-01','joshua','Document Fee - Good Moral','Cash',150,'Paid','07:33'],
 ['TXN-0836',null,'isabella','Misc. Fees','GCash',5400,'Failed','07:20'],
];
foreach ($pay as [$t,$or,$u,$f,$m,$a,$st,$tm])
    ins($pdo,'payments',['txn_ref'=>$t,'or_number'=>$or,'student_id'=>$stid[$u],'cashier_id'=>$uid['maria'],'fee_type'=>$f,'method'=>$m,
        'reference_no'=>$m==='Cash'?null:strtoupper(substr($m,0,3)).'-'.rand(100000,999999),'amount'=>$a,'status'=>$st,'paid_at'=>date('Y-m-d')." $tm:00"]);
ins($pdo,'payments',['txn_ref'=>'TXN-0700','or_number'=>'OR-2026-00418-00','student_id'=>$stid['juan'],'cashier_id'=>$uid['maria'],
    'fee_type'=>'Tuition Fee - 1st Semester','method'=>'Cash','amount'=>21500,'paid_at'=>date('Y-m-d',strtotime('-2 days')).' 09:30:00']);

// ---- Document requests
$reqs = [
 ['carlos','Certificate of Grades','Employment','Campus Pickup',1,'Pending','8 days'],
 ['maria.a','Certificate of Enrollment','Scholarship','Campus Pickup',1,'Processing','9 days'],
 ['john','Certificate of Good Moral','Internship','Campus Pickup',1,'Ready','11 days'],
 ['katrina','Certificate of Grades','Transfer','Delivery',2,'Pending','12 days'],
 ['miguel','Certificate of Enrollment','Visa Application','Campus Pickup',1,'Processing','14 days'],
 ['sofia.g','Certificate of Good Moral','Employment','Campus Pickup',1,'Ready','15 days'],
];
foreach ($reqs as [$u,$dt,$pu,$dm,$cp,$st,$when]) {
    $rid = ins($pdo,'document_requests',['student_id'=>$stid[$u],'doc_type'=>$dt,'purpose'=>$pu,'delivery_method'=>$dm,'copies'=>$cp,
        'date_needed'=>date('Y-m-d',strtotime('+7 days')),'fee'=>$cp*50+($dm==='Delivery'?100:0),'status'=>$st,'created_at'=>$ago($when)]);
    ins($pdo,'request_timeline',['request_id'=>$rid,'label'=>'Request submitted','detail'=>'Submitted by student','created_at'=>$ago($when)]);
    if ($st !== 'Pending') ins($pdo,'request_timeline',['request_id'=>$rid,'label'=>'Registrar review','detail'=>$st==='Processing'?'Request is being processed':'Approved','created_at'=>$ago('2 days')]);
    if ($st === 'Ready') ins($pdo,'request_timeline',['request_id'=>$rid,'label'=>'Ready for release','detail'=>'Document is ready','created_at'=>$ago('1 day')]);
}

// ---- Announcements, password resets, activity, notifications
foreach ([
 ['Enrollment for 2nd Semester','Enrollment period starts January 15. Please prepare your documents.','Enrollment','2025-01-10'],
 ['Final Exam Schedule Released','Check your subject schedule for the final examination period.','Academics','2025-01-08'],
 ['Library System Maintenance','The library portal will be unavailable on Jan 12, 8AM-12PM.','System','2025-01-07'],
] as [$t,$b,$g,$d]) ins($pdo,'announcements',['title'=>$t,'body'=>$b,'tag'=>$g,'posted_on'=>$d]);
foreach (['sarah','emily','olivia'] as $u) ins($pdo,'password_reset_requests',['username'=>$u]);
$pdo->exec("UPDATE users SET status='inactive' WHERE username IN ('rafael','andres')");
foreach ([
 [$uid['msantos'],'cleared 3 students (Library)','5 minutes'],[$uid['cashier2'],'approved 2 document requests','20 minutes'],
 [$uid['maria'],'recorded a payment','1 hour'],[$uid['admin'],'deactivated Noah Davis','2 hours'],
] as [$u,$a,$w]) ins($pdo,'activity_log',['user_id'=>$u,'action'=>$a,'created_at'=>$ago($w)]);
$carlosUser = $pdo->query("SELECT user_id FROM students WHERE id={$stid['carlos']}")->fetchColumn();
ins($pdo,'notifications',['user_id'=>$carlosUser,'message'=>'Laboratory cleared your clearance (Step 2 of 6).']);
ins($pdo,'notifications',['user_id'=>$carlosUser,'message'=>'Your Certificate of Grades request is pending registrar review.']);

echo "Seeded OK. Demo password for all accounts: " . PASSWORD . "\n";
