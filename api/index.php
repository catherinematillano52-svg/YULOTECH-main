<?php
// SSIS REST API. Routed by PATH_INFO: /api/index.php/<resource>
require __DIR__ . '/lib.php';

session_name('ssis_session');
session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax', 'path' => '/']);
session_start();

$method = $_SERVER['REQUEST_METHOD'];
$path = '/' . trim($_SERVER['PATH_INFO'] ?? '', '/');

$routes = [];
function route(string $m, string $pattern, callable $fn): void {
    global $routes;
    $routes[] = [$m, '#^' . preg_replace('#:(\w+)#', '(?P<$1>[^/]+)', $pattern) . '$#', $fn];
}

require __DIR__ . '/routes_auth.php';
require __DIR__ . '/routes_student.php';
require __DIR__ . '/routes_registrar.php';
require __DIR__ . '/routes_cashier.php';
require __DIR__ . '/routes_department.php';
require __DIR__ . '/routes_admin.php';

try {
    foreach ($routes as [$m, $re, $fn]) {
        if ($m === $method && preg_match($re, $path, $mt)) {
            $fn(array_filter($mt, 'is_string', ARRAY_FILTER_USE_KEY));
            exit;
        }
    }
    fail('Not found', 404);
} catch (PDOException $e) {
    error_log($e->getMessage());
    fail('Database error. Is MySQL running and the database seeded?', 500);
}
