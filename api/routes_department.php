<?php
function myOffice(): array {
    $u = requireRole('department');
    $step = array_search($u['unit'], cfg('offices'), true);
    if ($step === false) fail('Your account is not assigned to a clearance office.', 403);
    return [$u, $step + 1];
}

route('GET', '/department/dashboard', function () {
    [$u, $step] = myOffice();
    $c = fn($s) => (int)val('SELECT COUNT(*) FROM clearance_steps WHERE step = ? AND status = ?', [$step, $s]);
    $total = (int)val('SELECT COUNT(*) FROM clearance_steps WHERE step = ?', [$step]);
    out([
        'name' => $u['full_name'], 'office' => $u['unit'], 'total' => $total,
        'pending' => $c('Pending'), 'cleared' => $c('Cleared'), 'onHold' => $c('On Hold'),
        'recent' => rows('SELECT st.full_name AS student, st.student_no AS studentNo, st.program_name AS course, c.status, c.updated_at AS at
                          FROM clearance_steps c JOIN students st ON st.id = c.student_id
                          WHERE c.step = ? ORDER BY c.updated_at IS NULL, c.updated_at DESC, c.id DESC LIMIT 5', [$step]),
    ]);
});

route('GET', '/department/clearance', function () {
    [$u, $step] = myOffice();
    [$p, $per, $off] = page();
    $w = ['c.step = ?']; $a = [$step];
    if (($s = trim($_GET['q'] ?? '')) !== '') { $w[] = '(st.full_name LIKE ? OR st.student_no LIKE ?)'; array_push($a, like($s), like($s)); }
    if (!empty($_GET['status'])) { $w[] = 'c.status = ?'; $a[] = $_GET['status']; }
    if (!empty($_GET['course'])) { $w[] = 'st.program_name = ?'; $a[] = $_GET['course']; }
    $where = implode(' AND ', $w);
    $total = (int)val("SELECT COUNT(*) FROM clearance_steps c JOIN students st ON st.id = c.student_id WHERE $where", $a);
    $items = rows("SELECT st.id, st.student_no AS studentNo, st.full_name AS name, st.program_name AS course, c.status, c.remarks,
              (SELECT COUNT(*) FROM clearance_steps p WHERE p.student_id = st.id AND p.step < c.step AND p.status <> 'Cleared') AS blockers
              FROM clearance_steps c JOIN students st ON st.id = c.student_id WHERE $where ORDER BY st.student_no LIMIT $per OFFSET $off", $a);
    foreach ($items as &$i) { $i['locked'] = $i['blockers'] > 0; unset($i['blockers']); }
    out(['items' => $items, 'total' => $total, 'page' => $p, 'per' => $per, 'office' => $u['unit'],
         'courses' => array_column(rows('SELECT DISTINCT program_name FROM students ORDER BY program_name'), 'program_name')]);
});

route('POST', '/department/clearance/:id', function ($r) {
    [$u, $step] = myOffice();
    $c = row('SELECT c.*, st.user_id, st.id AS sid FROM clearance_steps c JOIN students st ON st.id = c.student_id
              WHERE c.student_id = ? AND c.step = ?', [$r['id'], $step]);
    if (!$c) fail('Student is not on your clearance list.', 404);
    $action = str('action', 6); $remarks = str('remarks', 255);
    if (!in_array($action, ['clear', 'hold'], true)) fail('Unknown action.');
    if ($action === 'clear') {
        $blocker = row("SELECT office FROM clearance_steps WHERE student_id = ? AND step < ? AND status <> 'Cleared' ORDER BY step LIMIT 1", [$c['sid'], $step]);
        if ($blocker) fail("Locked: {$blocker['office']} must clear this student first.", 409);
        if ($step === 4 && balanceDue($c['sid']) > 0) fail('Student still has an unpaid balance. Place a hold instead.', 409);
    }
    $status = $action === 'clear' ? 'Cleared' : 'On Hold';
    if ($action === 'hold' && $remarks === '') $remarks = 'Placed on hold by ' . $u['unit'];
    if ($action === 'clear' && $remarks === '') $remarks = 'Cleared by ' . $u['unit'];
    q('UPDATE clearance_steps SET status = ?, remarks = ?, updated_by = ?, updated_at = NOW() WHERE id = ?', [$status, $remarks, $u['id'], $c['id']]);
    logActivity($u['id'], ($action === 'clear' ? 'cleared' : 'placed on hold') . " student #{$c['sid']} ({$u['unit']})");
    if ($c['user_id']) notify($c['user_id'], "{$u['unit']} " . ($action === 'clear' ? "cleared your clearance (Step $step of 6)." : 'placed your clearance on hold.'));
    out(['ok' => true, 'status' => $status]);
});

route('POST', '/department/clearance', function () {
    [$u, $step] = myOffice();
    $no = str('studentNo', 20); $name = str('name', 120); $course = str('course', 120);
    if ($no === '') fail('Enter a student number.');
    $s = row('SELECT id FROM students WHERE student_no = ?', [$no]);
    if (!$s) {
        if ($name === '' || $course === '') fail('Student not found. Enter a full name and course to add a new record.');
        $s = ['id' => insertRow("INSERT INTO students (student_no, full_name, program, program_name, year_level) VALUES (?,?,?,?,1)", [$no, $name, substr($course, 0, 20), $course])];
        q('INSERT INTO student_balances (student_id) VALUES (?)', [$s['id']]);
    }
    foreach (cfg('offices') as $i => $office)
        q(isPg() ? 'INSERT INTO clearance_steps (student_id, step, office) VALUES (?,?,?) ON CONFLICT DO NOTHING'
                 : 'INSERT IGNORE INTO clearance_steps (student_id, step, office) VALUES (?,?,?)', [$s['id'], $i + 1, $office]);
    $status = str('status', 10);
    if (in_array($status, ['Cleared', 'On Hold'], true)) {
        q('UPDATE clearance_steps SET status = ?, updated_by = ?, updated_at = NOW() WHERE student_id = ? AND step = ?', [$status, $u['id'], $s['id'], $step]);
    }
    logActivity($u['id'], "added student $no to the clearance list");
    out(['ok' => true], 201);
});
