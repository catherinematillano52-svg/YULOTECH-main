<?php
const REQ_STATUSES = ['Pending', 'Processing', 'Ready', 'Rejected'];

route('GET', '/registrar/dashboard', function () {
    $u = requireRole('registrar');
    out([
        'firstName' => explode(' ', $u['full_name'])[0],
        'totalStudents' => (int)val("SELECT COUNT(*) FROM students WHERE enrollment_status = 'Enrolled'"),
        'gradesToEncode' => (int)val('SELECT COUNT(*) FROM enrollments WHERE grade IS NULL'),
        'coursesToEncode' => (int)val('SELECT COUNT(DISTINCT subject_id) FROM enrollments WHERE grade IS NULL'),
        'pending' => (int)val("SELECT COUNT(*) FROM document_requests WHERE status = 'Pending'"),
        'ready' => (int)val("SELECT COUNT(*) FROM document_requests WHERE status = 'Ready'"),
        'profileEdits' => (int)val("SELECT COUNT(*) FROM profile_edit_requests WHERE status = 'Pending'"),
        'recent' => rows('SELECT d.id, st.full_name AS student, st.student_no AS studentNo, d.doc_type AS docType, d.status
                          FROM document_requests d JOIN students st ON st.id = d.student_id ORDER BY d.id DESC LIMIT 5'),
    ]);
});

route('GET', '/registrar/students', function () {
    requireRole('registrar');
    [$p, $per, $off] = page();
    $w = ['1=1']; $a = [];
    if (($s = trim($_GET['q'] ?? '')) !== '') { $w[] = '(full_name LIKE ? OR student_no LIKE ?)'; array_push($a, like($s), like($s)); }
    if (!empty($_GET['program'])) { $w[] = 'program = ?'; $a[] = $_GET['program']; }
    if (!empty($_GET['year'])) { $w[] = 'year_level = ?'; $a[] = (int)$_GET['year']; }
    if (!empty($_GET['status'])) { $w[] = 'enrollment_status = ?'; $a[] = $_GET['status']; }
    $where = implode(' AND ', $w);
    $total = (int)val("SELECT COUNT(*) FROM students WHERE $where", $a);
    $items = rows("SELECT id, student_no AS studentNo, full_name AS name, program_name AS programName, program, year_level AS yearLevel,
                          enrollment_status AS status FROM students WHERE $where ORDER BY student_no LIMIT $per OFFSET $off", $a);
    out(['items' => $items, 'total' => $total, 'page' => $p, 'per' => $per,
         'programs' => array_column(rows('SELECT DISTINCT program FROM students ORDER BY program'), 'program')]);
});

route('GET', '/registrar/students/:id', function ($r) {
    requireRole('registrar');
    $s = row('SELECT * FROM students WHERE id = ?', [$r['id']]);
    if (!$s) fail('Student not found.', 404);
    $cs = courses($s['id']);
    out(['student' => [
        'id' => $s['id'], 'name' => $s['full_name'], 'studentNo' => $s['student_no'], 'program' => $s['program'], 'programName' => $s['program_name'],
        'yearLevel' => $s['year_level'], 'section' => $s['section'], 'status' => $s['enrollment_status'], 'birthDate' => $s['birth_date'],
        'gender' => $s['gender'], 'email' => $s['email'], 'contact' => $s['contact'], 'address' => $s['address'],
        'units' => array_sum(array_column($cs, 'units')), 'term' => cfg('term'),
    ], 'grades' => $cs]);
});

route('PUT', '/registrar/students/:id', function ($r) {
    $u = requireRole('registrar');
    $s = row('SELECT id FROM students WHERE id = ?', [$r['id']]);
    if (!$s) fail('Student not found.', 404);
    $status = str('status', 20);
    if (!in_array($status, ['Enrolled', 'On Leave', 'Pending'], true)) fail('Invalid enrollment status.');
    $name = str('name', 120);
    $email = str('email', 120);
    if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Enter a valid name and email.');
    $year = (int)(body()['yearLevel'] ?? 0);
    if ($year < 1 || $year > 6) fail('Year level must be 1-6.');
    q('UPDATE students SET full_name=?, email=?, contact=?, address=?, year_level=?, section=?, enrollment_status=? WHERE id=?',
      [$name, $email, str('contact', 30), str('address'), $year, str('section', 20), $status, $s['id']]);
    logActivity($u['id'], "updated student record #{$s['id']}");
    out(['ok' => true]);
});

route('GET', '/registrar/grades/:id', function ($r) {
    requireRole('registrar');
    $s = row('SELECT id, full_name, student_no FROM students WHERE id = ?', [$r['id']]);
    if (!$s) fail('Student not found.', 404);
    out(['student' => ['id' => $s['id'], 'name' => $s['full_name'], 'studentNo' => $s['student_no']],
         'term' => cfg('term'), 'items' => courses($s['id'])]);
});

route('PUT', '/registrar/grades/:id', function ($r) {
    $u = requireRole('registrar');
    $s = row('SELECT id FROM students WHERE id = ?', [$r['id']]);
    if (!$s) fail('Student not found.', 404);
    $grades = body()['grades'] ?? [];
    if (!is_array($grades) || !$grades) fail('No grades to save.');
    db()->beginTransaction();
    foreach ($grades as $g) {
        $raw = $g['grade'] ?? null;
        if ($raw === '' || $raw === null) { $val = null; }
        else {
            if (!is_numeric($raw) || $raw < 1.0 || $raw > 5.0) { db()->rollBack(); fail('Grades must be between 1.00 and 5.00.'); }
            $val = round((float)$raw, 2);
        }
        q('UPDATE enrollments SET grade = ? WHERE id = ? AND student_id = ?', [$val, (int)($g['id'] ?? 0), $s['id']]);
    }
    db()->commit();
    logActivity($u['id'], "encoded grades for student #{$s['id']}");
    if ($uid = val('SELECT user_id FROM students WHERE id = ?', [$s['id']])) notify($uid, 'Your grades have been updated by the Registrar.');
    out(['ok' => true]);
});

route('GET', '/registrar/requests', function () {
    requireRole('registrar');
    [$p, $per, $off] = page();
    $w = ['1=1']; $a = [];
    if (($s = trim($_GET['q'] ?? '')) !== '') {
        $code = isPg() ? "('REQ-' || LPAD(d.id::text, 4, '0'))" : "CONCAT('REQ-', LPAD(d.id, 4, '0'))";
        $w[] = "(st.full_name LIKE ? OR st.student_no LIKE ? OR $code LIKE ?)";
        array_push($a, like($s), like($s), like($s));
    }
    if (!empty($_GET['type'])) { $w[] = 'd.doc_type = ?'; $a[] = $_GET['type']; }
    if (!empty($_GET['status'])) { $w[] = 'd.status = ?'; $a[] = $_GET['status']; }
    $where = implode(' AND ', $w);
    $total = (int)val("SELECT COUNT(*) FROM document_requests d JOIN students st ON st.id = d.student_id WHERE $where", $a);
    $items = rows("SELECT d.id, st.full_name AS student, st.student_no AS studentNo, d.doc_type AS docType, d.purpose,
                          d.created_at AS requestedOn, d.status
                   FROM document_requests d JOIN students st ON st.id = d.student_id WHERE $where
                   ORDER BY d.id DESC LIMIT $per OFFSET $off", $a);
    foreach ($items as &$i) $i['code'] = sprintf('REQ-%04d', $i['id']);
    $count = fn($s) => (int)val('SELECT COUNT(*) FROM document_requests' . ($s ? ' WHERE status = ?' : ''), $s ? [$s] : []);
    out(['items' => $items, 'total' => $total, 'page' => $p, 'per' => $per,
         'stats' => ['total' => $count(null), 'pending' => $count('Pending'), 'processing' => $count('Processing'), 'ready' => $count('Ready')],
         'profileEdits' => rows("SELECT e.id, st.full_name AS student, st.student_no AS studentNo, e.reason, e.created_at AS createdAt,
                                        e.full_name AS newName, e.email AS newEmail, e.contact AS newContact, e.address AS newAddress
                                 FROM profile_edit_requests e JOIN students st ON st.id = e.student_id
                                 WHERE e.status = 'Pending' ORDER BY e.id")]);
});

route('GET', '/registrar/requests/:id', function ($r) {
    requireRole('registrar');
    $d = row('SELECT d.*, st.full_name, st.student_no, st.program_name, st.year_level, st.email, st.contact
              FROM document_requests d JOIN students st ON st.id = d.student_id WHERE d.id = ?', [$r['id']]);
    if (!$d) fail('Request not found.', 404);
    out(['request' => [
        'id' => $d['id'], 'code' => sprintf('REQ-%04d', $d['id']), 'docType' => $d['doc_type'], 'purpose' => $d['purpose'],
        'requestedOn' => $d['created_at'], 'copies' => $d['copies'], 'delivery' => $d['delivery_method'], 'fee' => (float)$d['fee'],
        'status' => $d['status'], 'remarks' => $d['registrar_remarks'], 'studentRemarks' => $d['remarks_student'], 'dateNeeded' => $d['date_needed'],
        'student' => ['name' => $d['full_name'], 'studentNo' => $d['student_no'], 'program' => $d['program_name'],
                      'yearLevel' => $d['year_level'], 'email' => $d['email'], 'contact' => $d['contact']],
        'timeline' => rows('SELECT label, detail, created_at AS at FROM request_timeline WHERE request_id = ? ORDER BY id', [$d['id']]),
    ]]);
});

route('POST', '/registrar/requests/:id/action', function ($r) {
    $u = requireRole('registrar');
    $d = row('SELECT d.*, st.user_id FROM document_requests d JOIN students st ON st.id = d.student_id WHERE d.id = ?', [$r['id']]);
    if (!$d) fail('Request not found.', 404);
    $action = str('action', 12); $remark = str('remark', 500);
    $map = ['approve' => ['Ready', 'Ready for release'], 'processing' => ['Processing', 'Registrar review'], 'reject' => ['Rejected', 'Rejected']];
    if (!isset($map[$action])) fail('Unknown action.');
    if ($action === 'reject' && $remark === '') fail('A remark is required when rejecting a request.');
    [$status, $label] = $map[$action];
    q('UPDATE document_requests SET status = ?, registrar_remarks = ? WHERE id = ?', [$status, $remark ?: $d['registrar_remarks'], $d['id']]);
    $detail = match ($action) { 'approve' => 'Approved. Document is ready.', 'processing' => 'Request is being processed.', 'reject' => $remark };
    q('INSERT INTO request_timeline (request_id, label, detail) VALUES (?,?,?)', [$d['id'], $label, $detail]);
    $code = sprintf('REQ-%04d', $d['id']);
    logActivity($u['id'], "set $code to $status");
    if ($d['user_id']) notify($d['user_id'], "Your {$d['doc_type']} request ($code) is now $status.");
    out(['ok' => true, 'status' => $status]);
});

route('POST', '/registrar/profile-edits/:id', function ($r) {
    $u = requireRole('registrar');
    $e = row("SELECT * FROM profile_edit_requests WHERE id = ? AND status = 'Pending'", [$r['id']]);
    if (!$e) fail('Request not found or already handled.', 404);
    $approve = str('action', 10) === 'approve';
    db()->beginTransaction();
    if ($approve) {
        q('UPDATE students SET full_name=?, email=?, contact=?, birth_date=?, gender=?, civil_status=?, address=? WHERE id=?',
          [$e['full_name'], $e['email'], $e['contact'], $e['birth_date'], $e['gender'], $e['civil_status'], $e['address'], $e['student_id']]);
        q('UPDATE users SET full_name = ?, email = ? WHERE id = (SELECT user_id FROM students WHERE id = ?)', [$e['full_name'], $e['email'], $e['student_id']]);
    }
    q('UPDATE profile_edit_requests SET status = ? WHERE id = ?', [$approve ? 'Approved' : 'Rejected', $e['id']]);
    db()->commit();
    logActivity($u['id'], ($approve ? 'approved' : 'rejected') . " profile edit #{$e['id']}");
    if ($uid = val('SELECT user_id FROM students WHERE id = ?', [$e['student_id']]))
        notify($uid, 'Your profile edit request was ' . ($approve ? 'approved.' : 'rejected.'));
    out(['ok' => true]);
});
