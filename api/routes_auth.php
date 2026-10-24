<?php
function userPayload(array $u): array {
    return ['id' => $u['id'], 'name' => $u['full_name'], 'email' => $u['email'], 'role' => $u['role'], 'unit' => $u['unit']];
}

route('POST', '/login', function () {
    $username = str('username', 60);
    $password = (string)(body()['password'] ?? '');
    $type = str('type', 10);
    if ($username === '' || $password === '') fail('Enter your username and password.');
    $u = row('SELECT * FROM users WHERE username = ? OR email = ?', [$username, $username]);
    if (!$u || !password_verify($password, $u['password_hash'])) {
        logActivity($u['id'] ?? null, "failed sign-in attempt for '$username'");
        fail('Invalid username or password.', 401);
    }
    if ($u['status'] !== 'active') fail('This account is inactive. Contact your administrator.', 403);
    $isStudent = $u['role'] === 'student';
    if ($type === 'student' && !$isStudent) fail('This is a staff account. Use the Staff tab.', 403);
    if ($type === 'staff' && $isStudent) fail('This is a student account. Use the Student tab.', 403);
    session_regenerate_id(true);
    $_SESSION['uid'] = $u['id'];
    q('UPDATE users SET last_login = NOW() WHERE id = ?', [$u['id']]);
    logActivity($u['id'], 'signed in');
    out(['user' => userPayload($u), 'mustChangePassword' => (bool)$u['must_change_password']]);
});

route('POST', '/logout', function () {
    if ($u = me()) logActivity($u['id'], 'signed out');
    $_SESSION = [];
    session_destroy();
    out(['ok' => true]);
});

route('GET', '/me', function () {
    $u = me();
    if (!$u) fail('Not signed in.', 401);
    out(['user' => userPayload($u)]);
});

route('POST', '/forgot', function () {
    $username = str('username', 60);
    if ($username === '') fail('Enter your username first.');
    $u = row('SELECT id FROM users WHERE username = ? OR email = ?', [$username, $username]);
    if ($u) {
        q("INSERT INTO password_reset_requests (username) VALUES (?)", [$username]);
        logActivity($u['id'], 'requested a password reset');
    }
    // Same response either way so usernames cannot be probed.
    out(['ok' => true, 'message' => 'If the account exists, an administrator will review your reset request.']);
});

route('POST', '/password', function () {
    $u = requireRole();
    $new = (string)(body()['password'] ?? '');
    if (strlen($new) < 8) fail('Password must be at least 8 characters.');
    q('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?', [password_hash($new, PASSWORD_DEFAULT), $u['id']]);
    logActivity($u['id'], 'changed their password');
    out(['ok' => true]);
});

route('GET', '/notifications', function () {
    $u = requireRole();
    out(['items' => rows('SELECT id, message, is_read AS isRead, created_at AS at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 10', [$u['id']])]);
});
route('POST', '/notifications/read', function () {
    $u = requireRole();
    q('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [$u['id']]);
    out(['ok' => true]);
});
