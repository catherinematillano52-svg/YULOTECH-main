<?php
const ROLES = ['student', 'registrar', 'cashier', 'department', 'admin'];

route('GET', '/admin/dashboard', function () {
    $u = requireRole('admin');
    $total = (int)val('SELECT COUNT(*) FROM users');
    $byRole = rows('SELECT role, COUNT(*) AS n FROM users GROUP BY role');
    $counts = array_column($byRole, 'n', 'role');
    $inactive = (int)val("SELECT COUNT(*) FROM users WHERE status = 'inactive'");
    $resets = (int)val("SELECT COUNT(*) FROM password_reset_requests WHERE status = 'Pending'");
    $never = (int)val("SELECT COUNT(*) FROM users WHERE last_login IS NULL AND status = 'active'");
    $accounts = rows('SELECT id, full_name AS name, role, unit, created_at AS at FROM users ORDER BY created_at DESC, id DESC LIMIT 4');
    $activity = rows('SELECT a.id, a.user_id AS userId, u.full_name AS actor, a.action, a.created_at AS at
                      FROM activity_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 6');
    out([
        'firstName' => explode(' ', $u['full_name'])[0], 'myId' => $u['id'], 'total' => $total,
        'students' => $counts['student'] ?? 0, 'staff' => $total - ($counts['student'] ?? 0), 'inactive' => $inactive,
        'roles' => array_map(fn($r) => ['role' => $r, 'n' => $counts[$r] ?? 0, 'pct' => $total ? (int)round(($counts[$r] ?? 0) / $total * 100) : 0], ROLES),
        'attention' => ['inactive' => $inactive, 'resets' => $resets, 'neverLoggedIn' => $never],
        'accounts' => $accounts, 'activity' => $activity,
    ]);
});

route('GET', '/admin/users', function () {
    requireRole('admin');
    [$p, $per, $off] = page();
    $w = ['1=1']; $a = [];
    if (($s = trim($_GET['q'] ?? '')) !== '') { $w[] = '(full_name LIKE ? OR email LIKE ? OR username LIKE ?)'; array_push($a, like($s), like($s), like($s)); }
    if (!empty($_GET['role'])) { $w[] = 'role = ?'; $a[] = $_GET['role']; }
    if (!empty($_GET['status'])) { $w[] = 'status = ?'; $a[] = $_GET['status']; }
    $where = implode(' AND ', $w);
    $total = (int)val("SELECT COUNT(*) FROM users WHERE $where", $a);
    $items = rows("SELECT id, username, full_name AS name, email, role, unit, status, created_at AS createdAt, last_login AS lastLogin
                   FROM users WHERE $where ORDER BY created_at DESC, id DESC LIMIT $per OFFSET $off", $a);
    out(['items' => $items, 'total' => $total, 'page' => $p, 'per' => $per,
         'resetPending' => array_column(rows("SELECT DISTINCT username FROM password_reset_requests WHERE status = 'Pending'"), 'username')]);
});

function validateUser(bool $creating): array {
    $name = str('name', 120); $email = strtolower(str('email', 120)); $role = str('role', 12);
    $unit = str('unit', 80); $status = str('status', 10) ?: 'active';
    if ($name === '') fail('Full name is required.');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Enter a valid email address.');
    if (!in_array($role, ROLES, true)) fail('Select a role.');
    if (!in_array($status, ['active', 'inactive'], true)) fail('Invalid status.');
    if ($role === 'department' && !in_array($unit, cfg('offices'), true)) fail('Department staff need a clearance office: ' . implode(', ', cfg('offices')) . '.');
    return [$name, $email, $role, $unit, $status];
}

route('POST', '/admin/users', function () {
    $me = requireRole('admin');
    [$name, $email, $role, $unit, $status] = validateUser(true);
    $pw = (string)(body()['password'] ?? '');
    if (strlen($pw) < 8) fail('Temporary password must be at least 8 characters.');
    if (val('SELECT COUNT(*) FROM users WHERE email = ?', [$email])) fail('That email is already registered.', 409);
    $base = preg_replace('/[^a-z0-9._]/', '', explode('@', $email)[0]) ?: 'user';
    $username = $base; $i = 1;
    while (val('SELECT COUNT(*) FROM users WHERE username = ?', [$username])) $username = $base . ++$i;
    $create = function () use ($username, $name, $email, $pw, $role, $unit, $status) {
        db()->beginTransaction();
        try {
            $uid = insertRow('INSERT INTO users (username, full_name, email, password_hash, role, unit, status, must_change_password) VALUES (?,?,?,?,?,?,?,1)',
              [$username, $name, $email, password_hash($pw, PASSWORD_DEFAULT), $role, $unit ?: null, $status]);
            if ($role === 'student') {
                // Number is taken from the users id; step past any number already issued (seeded or entered by hand).
                $n = $uid;
                do { $no = date('Y') . '-' . str_pad((string)$n++, 5, '0', STR_PAD_LEFT); } while (val('SELECT COUNT(*) FROM students WHERE student_no = ?', [$no]));
                // students.program is VARCHAR(20); a longer "Grade / Department" entry must not abort the account.
                $sid = insertRow('INSERT INTO students (user_id, student_no, full_name, program, program_name, year_level, email) VALUES (?,?,?,?,?,1,?)',
                  [$uid, $no, $name, substr($unit ?: 'TBD', 0, 20), $unit ?: 'To be assigned', $email]);
                q('INSERT INTO student_balances (student_id) VALUES (?)', [$sid]);
                foreach (cfg('offices') as $k => $o) q('INSERT INTO clearance_steps (student_id, step, office) VALUES (?,?,?)', [$sid, $k + 1, $o]);
            }
            db()->commit();
        } catch (Throwable $e) {
            if (db()->inTransaction()) db()->rollBack();
            throw $e;
        }
    };
    try {
        $create();
    } catch (PDOException $e) {
        // Postgres: a sequence that lags the rows already in the table (data loaded with explicit ids) gives a duplicate key
        // on the primary key. Re-sync every id sequence once and retry.
        if (!isPg() || $e->getCode() !== '23505' || stripos($e->getMessage(), '_pkey') === false) throw $e;
        foreach (['users', 'students', 'clearance_steps'] as $t)
            db()->query("SELECT setval(pg_get_serial_sequence('$t', 'id'), COALESCE((SELECT MAX(id) FROM $t), 1))");
        $create();
    }
    logActivity($me['id'], "created account $username ($role)");
    out(['ok' => true, 'username' => $username], 201);
});

route('PUT', '/admin/users/:id', function ($r) {
    $me = requireRole('admin');
    $t = row('SELECT id, username FROM users WHERE id = ?', [$r['id']]);
    if (!$t) fail('User not found.', 404);
    [$name, $email, $role, $unit, $status] = validateUser(false);
    if (val('SELECT COUNT(*) FROM users WHERE email = ? AND id <> ?', [$email, $t['id']])) fail('That email is already registered.', 409);
    if ($t['id'] === $me['id'] && ($status !== 'active' || $role !== 'admin')) fail('You cannot deactivate or demote your own account.', 409);
    q('UPDATE users SET full_name=?, email=?, role=?, unit=?, status=? WHERE id=?', [$name, $email, $role, $unit ?: null, $status, $t['id']]);
    logActivity($me['id'], "updated account {$t['username']}");
    out(['ok' => true]);
});

route('POST', '/admin/users/:id/status', function ($r) {
    $me = requireRole('admin');
    $t = row('SELECT id, username FROM users WHERE id = ?', [$r['id']]);
    if (!$t) fail('User not found.', 404);
    $status = str('status', 10);
    if (!in_array($status, ['active', 'inactive'], true)) fail('Invalid status.');
    if ($t['id'] === $me['id']) fail('You cannot deactivate your own account.', 409);
    q('UPDATE users SET status = ? WHERE id = ?', [$status, $t['id']]);
    logActivity($me['id'], ($status === 'inactive' ? 'deactivated' : 'activated') . " {$t['username']}");
    out(['ok' => true]);
});

route('POST', '/admin/users/:id/reset', function ($r) {
    $me = requireRole('admin');
    $t = row('SELECT id, username FROM users WHERE id = ?', [$r['id']]);
    if (!$t) fail('User not found.', 404);
    $pw = (string)(body()['password'] ?? '');
    if (strlen($pw) < 8) fail('Temporary password must be at least 8 characters.');
    q('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?', [password_hash($pw, PASSWORD_DEFAULT), $t['id']]);
    q("UPDATE password_reset_requests SET status = 'Done' WHERE username = ? AND status = 'Pending'", [$t['username']]);
    logActivity($me['id'], "reset the password of {$t['username']}");
    out(['ok' => true]);
});
