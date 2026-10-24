<?php
// Database + app settings. Override with environment variables if needed.
return [
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
