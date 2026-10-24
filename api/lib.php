<?php
// Shared helpers: DB connection, JSON responses, session auth, activity log.
date_default_timezone_set('Asia/Manila');

function cfg(string $key) {
    static $c = null;
    $c ??= require __DIR__ . '/config.php';
    return $c[$key];
}

function db(): PDO {
    static $pdo = null;
    if (!$pdo) {
        $dsn = 'mysql:host=' . cfg('db_host') . ';port=' . cfg('db_port') . ';dbname=' . cfg('db_name') . ';charset=utf8mb4';
        $pdo = new PDO($dsn, cfg('db_user'), cfg('db_pass'), [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_STRINGIFY_FETCHES => false,
        ]);
        $pdo->exec("SET time_zone = '+08:00'");
    }
    return $pdo;
}

function q(string $sql, array $params = []): PDOStatement {
    $st = db()->prepare($sql);
    $st->execute($params);
    return $st;
}
// DECIMAL columns arrive as strings from MySQL; cast them so JSON carries real numbers.
function castDecimals(PDOStatement $st, array $rows): array {
    $dec = [];
    for ($i = 0; $i < $st->columnCount(); $i++) {
        $m = $st->getColumnMeta($i);
        if (($m['native_type'] ?? '') === 'NEWDECIMAL') $dec[] = $m['name'];
    }
    if ($dec) foreach ($rows as &$r) foreach ($dec as $c) if (isset($r[$c])) $r[$c] = (float)$r[$c];
    return $rows;
}
function rows(string $sql, array $params = []): array { $st = q($sql, $params); return castDecimals($st, $st->fetchAll()); }
function row(string $sql, array $params = []): ?array { $st = q($sql, $params); $r = $st->fetch(); return $r ? castDecimals($st, [$r])[0] : null; }
function val(string $sql, array $params = []) { $r = q($sql, $params)->fetch(PDO::FETCH_NUM); return $r ? $r[0] : null; }

function out($data, int $code = 200): never {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION);
    exit;
}
function fail(string $msg, int $code = 400): never { out(['error' => $msg], $code); }

function body(): array {
    static $b = null;
    return $b ??= (json_decode(file_get_contents('php://input'), true) ?: []);
}
function str(string $key, int $max = 255): string {
    return mb_substr(trim((string)(body()[$key] ?? '')), 0, $max);
}

function me(): ?array {
    if (empty($_SESSION['uid'])) return null;
    $u = row('SELECT id, username, full_name, email, role, unit, status FROM users WHERE id = ?', [$_SESSION['uid']]);
    return ($u && $u['status'] === 'active') ? $u : null;
}
function requireRole(string ...$roles): array {
    $u = me();
    if (!$u) fail('Please sign in.', 401);
    if ($roles && !in_array($u['role'], $roles, true)) fail('You do not have access to this resource.', 403);
    return $u;
}
function logActivity(?int $userId, string $action): void {
    q('INSERT INTO activity_log (user_id, action) VALUES (?, ?)', [$userId, $action]);
}
function notify(int $userId, string $msg): void {
    q('INSERT INTO notifications (user_id, message) VALUES (?, ?)', [$userId, $msg]);
}
function page(): array {
    $p = max(1, (int)($_GET['page'] ?? 1));
    $per = min(50, max(1, (int)($_GET['per'] ?? 10)));
    return [$p, $per, ($p - 1) * $per];
}
function like(string $s): string { return '%' . addcslashes($s, '%_\\') . '%'; }
function remark(?float $g): ?string { return $g === null ? null : ($g <= 3.0 ? 'Passed' : 'Failed'); }
