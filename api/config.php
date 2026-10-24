<?php
// Database + app settings. Override with environment variables if needed.
// DATABASE_URL (Neon Postgres) comes from the environment or the project's .env.local; without it the app uses local MySQL.
if (!function_exists('envValue')) { function envValue(string $key): ?string {
    $v = getenv($key);
    if ($v !== false && $v !== '') return $v;
    $file = dirname(__DIR__) . '/.env.local';
    if (is_readable($file)) {
        foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            if (preg_match('/^\s*' . preg_quote($key, '/') . '\s*=\s*"?(.*?)"?\s*$/', $line, $m)) return $m[1];
        }
    }
    return null;
} }
$databaseUrl = envValue('DATABASE_URL');

return [
    'driver' => ($databaseUrl && envValue('SSIS_DB_DRIVER') !== 'mysql') ? 'pgsql' : 'mysql',
    'database_url' => $databaseUrl,
    'db_host' => getenv('SSIS_DB_HOST') ?: '127.0.0.1',
    'db_port' => getenv('SSIS_DB_PORT') ?: '3306',
    'db_name' => getenv('SSIS_DB_NAME') ?: 'yulotech_ssis',
    'db_user' => getenv('SSIS_DB_USER') ?: 'root',
    'db_pass' => getenv('SSIS_DB_PASS') ?: '',
    'doc_fee_per_copy' => 50,
    'delivery_fee' => 100,
    'term' => '1st Semester, A.Y. 2026-2027',
    'offices' => ['Library', 'Laboratory', 'Department', 'Finance / Tuition', 'Student Affairs', 'Registrar'],
];
