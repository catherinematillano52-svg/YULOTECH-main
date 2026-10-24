<?php
function myStudent(): array {
    $u = requireRole('student');
    $s = row('SELECT * FROM students WHERE user_id = ?', [$u['id']]);
    if (!$s) fail('No student record is linked to this account.', 404);
    return $s;
}
function balanceDue(int $studentId): float {
    $b = row('SELECT total_fees, amount_paid FROM student_balances WHERE student_id = ?', [$studentId]);
    return $b ? max(0, (float)$b['total_fees'] - (float)$b['amount_paid']) : 0.0;
}
function dayList(string $days): array {
    preg_match_all('/TH|M|T|W|F|S/', $days, $m);
    $map = ['M' => 1, 'T' => 2, 'W' => 3, 'TH' => 4, 'F' => 5, 'S' => 6];
    return array_map(fn($d) => $map[$d], $m[0]);
}
function courses(int $studentId): array {
    $r = rows('SELECT e.id, s.code, s.title, s.units, e.instructor, e.room, e.days, e.start_time, e.end_time, e.grade
               FROM enrollments e JOIN subjects s ON s.id = e.subject_id
               WHERE e.student_id = ? AND e.term = ? ORDER BY e.start_time, s.code', [$studentId, cfg('term')]);
    foreach ($r as &$c) {
        $c['grade'] = $c['grade'] === null ? null : (float)$c['grade'];
        $c['start_time'] = substr($c['start_time'], 0, 5);
        $c['end_time'] = substr($c['end_time'], 0, 5);
        $c['remarks'] = remark($c['grade']);
    }
    return $r;
}
function gwa(array $courses): ?float {
    $u = 0; $t = 0;
    foreach ($courses as $c) if ($c['grade'] !== null) { $t += $c['grade'] * $c['units']; $u += $c['units']; }
    return $u ? round($t / $u, 2) : null;
}
function clearanceFor(int $studentId): array {
    $steps = rows('SELECT step, office, status, remarks, updated_at FROM clearance_steps WHERE student_id = ? ORDER BY step', [$studentId]);
    $cleared = 0; $blocked = false; $awaiting = null; $hold = null;
    foreach ($steps as $i => &$s) {
        $s['locked'] = false;
        if ($s['status'] === 'Cleared') { $cleared++; continue; }
        if ($blocked) {
            $s['locked'] = true; $s['status'] = 'Locked';
            $s['remarks'] = 'Opens after ' . $steps[$i - 1]['office'] . ' clears';
            continue;
        }
        $blocked = true; $awaiting = $s['office'];
        if ($s['status'] === 'On Hold') $hold = $s['office'];
        $s['remarks'] ??= $s['status'] === 'Pending' ? 'Awaiting ' . strtolower($s['office']) . ' approval' : null;
    }
    $overall = $cleared === count($steps) ? 'CLEARED' : ($hold ? 'ON HOLD' : 'PENDING');
    $msg = $overall === 'CLEARED' ? 'All offices have cleared you.'
         : "$cleared of " . count($steps) . ' offices cleared. ' . ($hold ? "On hold at $hold." : "Awaiting $awaiting approval.");
    return ['steps' => $steps, 'cleared' => $cleared, 'total' => count($steps), 'overall' => $overall, 'message' => $msg];
}

route('GET', '/student/dashboard', function () {
    $s = myStudent();
    $cs = courses($s['id']);
    $cl = clearanceFor($s['id']);
    $ready = (int)val("SELECT COUNT(*) FROM document_requests WHERE student_id = ? AND status = 'Ready'", [$s['id']]);
    // Schedule for today, or the next day that has classes
    $dayNames = [1 => 'Monday', 2 => 'Tuesday', 3 => 'Wednesday', 4 => 'Thursday', 5 => 'Friday', 6 => 'Saturday', 7 => 'Sunday'];
    $schedule = []; $label = $dayNames[(int)date('N')];
    for ($i = 0; $i < 7 && !$schedule; $i++) {
        $d = ((int)date('N') - 1 + $i) % 7 + 1;
        $schedule = array_values(array_filter($cs, fn($c) => in_array($d, dayList($c['days']), true)));
        $label = $dayNames[$d];
    }
    out([
        'firstName' => explode(' ', $s['full_name'])[0], 'program' => $s['program'], 'yearLevel' => $s['year_level'],
        'studentNo' => $s['student_no'], 'gwa' => gwa($cs), 'units' => array_sum(array_column($cs, 'units')),
        'subjects' => count($cs), 'cleared' => $cl['cleared'], 'clearanceTotal' => $cl['total'], 'docsReady' => $ready,
        'announcements' => rows('SELECT id, title, body, tag, posted_on AS date FROM announcements ORDER BY posted_on DESC LIMIT 3'),
        'scheduleDay' => $label, 'schedule' => $schedule, 'term' => cfg('term'),
    ]);
});

route('GET', '/student/courses', function () {
    $s = myStudent(); $cs = courses($s['id']);
    out(['term' => cfg('term'), 'units' => array_sum(array_column($cs, 'units')), 'items' => $cs]);
});
route('GET', '/student/grades', function () {
    $s = myStudent(); $cs = courses($s['id']);
    out(['term' => cfg('term'), 'units' => array_sum(array_column($cs, 'units')), 'gwa' => gwa($cs), 'items' => $cs]);
});

route('GET', '/student/profile', function () {
    $s = myStudent(); $cs = courses($s['id']);
    out(['profile' => [
        'name' => $s['full_name'], 'studentNo' => $s['student_no'], 'program' => $s['program'], 'programName' => $s['program_name'],
        'yearLevel' => $s['year_level'], 'email' => $s['email'], 'contact' => $s['contact'], 'birthDate' => $s['birth_date'],
        'gender' => $s['gender'], 'civilStatus' => $s['civil_status'], 'address' => $s['address'], 'gwa' => gwa($cs),
    ], 'pendingEdit' => (bool)val("SELECT COUNT(*) FROM profile_edit_requests WHERE student_id = ? AND status = 'Pending'", [$s['id']])]);
});

route('POST', '/student/profile-edit', function () {
    $s = myStudent();
    $reason = str('reason', 500);
    if ($reason === '') fail('Please explain why this information needs to be updated.');
    $name = str('name', 120); $email = str('email', 120);
    if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Enter a valid name and email address.');
    $dob = str('birthDate', 10);
    q("UPDATE profile_edit_requests SET status = 'Rejected' WHERE student_id = ? AND status = 'Pending'", [$s['id']]);
    q('INSERT INTO profile_edit_requests (student_id, full_name, email, contact, birth_date, gender, civil_status, address, reason)
       VALUES (?,?,?,?,?,?,?,?,?)', [$s['id'], $name, $email, str('contact', 30), $dob ?: null, str('gender', 20),
        str('civilStatus', 20), str('address'), $reason]);
    logActivity($s['user_id'], 'submitted a profile edit request');
    out(['ok' => true]);
});

function docEligibility(array $s): array {
    $reasons = [];
    if ($s['pending_library_books'] > 0) $reasons[] = 'pending library books';
    if (balanceDue($s['id']) > 0) $reasons[] = 'an unpaid account balance';
    return ['blocked' => (bool)$reasons, 'reasons' => $reasons];
}

route('GET', '/student/documents', function () {
    $s = myStudent();
    $items = rows('SELECT id, doc_type AS docType, purpose, delivery_method AS delivery, copies, fee, status,
                          registrar_remarks AS remarks, date_needed AS dateNeeded, created_at AS createdAt
                   FROM document_requests WHERE student_id = ? ORDER BY id DESC', [$s['id']]);
    foreach ($items as &$r) {
        $r['code'] = sprintf('REQ-%04d', $r['id']);
        $r['timeline'] = rows('SELECT label, detail, created_at AS at FROM request_timeline WHERE request_id = ? ORDER BY id', [$r['id']]);
    }
    out(['items' => $items, 'eligibility' => docEligibility($s),
         'fees' => ['perCopy' => cfg('doc_fee_per_copy'), 'delivery' => cfg('delivery_fee')]]);
});

route('POST', '/student/documents', function () {
    $s = myStudent();
    $el = docEligibility($s);
    if ($el['blocked']) fail('You cannot submit a request while you have ' . implode(' or ', $el['reasons']) . '. Please clear them first.', 422);
    $type = str('docType', 40); $purpose = str('purpose', 60); $delivery = str('delivery', 20);
    $copies = (int)(body()['copies'] ?? 0); $needed = str('dateNeeded', 10);
    if (!in_array($type, ['Certificate of Enrollment', 'Certificate of Grades', 'Certificate of Good Moral'], true)) fail('Select a document type.');
    if ($purpose === '') fail('Select a purpose.');
    if (!in_array($delivery, ['Campus Pickup', 'Delivery'], true)) fail('Select a delivery method.');
    if ($copies < 1 || $copies > 10) fail('Copies must be between 1 and 10.');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $needed) || $needed < date('Y-m-d')) fail('Pick a valid date needed (today or later).');
    $fee = $copies * cfg('doc_fee_per_copy') + ($delivery === 'Delivery' ? cfg('delivery_fee') : 0);
    q('INSERT INTO document_requests (student_id, doc_type, purpose, delivery_method, copies, date_needed, remarks_student, fee)
       VALUES (?,?,?,?,?,?,?,?)', [$s['id'], $type, $purpose, $delivery, $copies, $needed, str('remarks', 500) ?: null, $fee]);
    $id = insertId('document_requests');
    q("INSERT INTO request_timeline (request_id, label, detail) VALUES (?, 'Request submitted', 'Submitted by student')", [$id]);
    logActivity($s['user_id'], "submitted $type request " . sprintf('REQ-%04d', $id));
    out(['ok' => true, 'code' => sprintf('REQ-%04d', $id), 'fee' => $fee], 201);
});

route('GET', '/student/clearance', function () {
    $s = myStudent();
    out(['student' => ['name' => $s['full_name'], 'studentNo' => $s['student_no'], 'program' => $s['program_name']],
         'term' => cfg('term')] + clearanceFor($s['id']));
});
