<?php
function studentFinance(array $s): array {
    $b = row('SELECT total_fees, amount_paid FROM student_balances WHERE student_id = ?', [$s['id']]) ?? ['total_fees' => 0, 'amount_paid' => 0];
    $total = (float)$b['total_fees']; $paid = (float)$b['amount_paid']; $due = max(0, $total - $paid);
    return [
        'id' => $s['id'], 'name' => $s['full_name'], 'studentNo' => $s['student_no'], 'program' => $s['program_name'],
        'programCode' => $s['program'], 'yearLevel' => $s['year_level'], 'enrollment' => $s['enrollment_status'],
        'totalFees' => $total, 'amountPaid' => $paid, 'balanceDue' => $due,
        'paymentStatus' => $due <= 0 ? 'Fully Paid' : ($paid > 0 ? 'Partially Paid' : 'Unpaid'),
        'history' => rows('SELECT paid_at AS date, fee_type AS description, amount, method, or_number AS orNumber
                           FROM payments WHERE student_id = ? AND status = ? ORDER BY id DESC LIMIT 8', [$s['id'], 'Paid']),
    ];
}

route('GET', '/cashier/dashboard', function () {
    $u = requireRole('cashier');
    $today = date('Y-m-d');
    $paidToday = row("SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS n FROM payments WHERE status='Paid' AND DATE(paid_at) = ?", [$today]);
    $yesterday = (int)val("SELECT COUNT(*) FROM payments WHERE or_number IS NOT NULL AND DATE(paid_at) = ?", [date('Y-m-d', strtotime('-1 day'))]);
    $receiptsToday = (int)val('SELECT COUNT(*) FROM payments WHERE or_number IS NOT NULL AND DATE(paid_at) = ?', [$today]);
    $pending = (int)val('SELECT COUNT(*) FROM student_balances WHERE total_fees > amount_paid');
    $byMethod = rows("SELECT method, SUM(amount) AS total FROM payments WHERE status='Paid' AND DATE(paid_at) = ? GROUP BY method ORDER BY total DESC", [$today]);
    $sum = array_sum(array_column($byMethod, 'total')) ?: 1;
    foreach ($byMethod as &$m) { $m['total'] = (float)$m['total']; $m['pct'] = (int)round($m['total'] / $sum * 100); }
    out([
        'name' => $u['full_name'], 'todayTotal' => (float)$paidToday['total'], 'todayCount' => (int)$paidToday['n'],
        'pendingStudents' => $pending, 'receiptsToday' => $receiptsToday, 'receiptsDelta' => $receiptsToday - $yesterday,
        'byMethod' => $byMethod,
        'recent' => rows('SELECT p.txn_ref AS ref, st.full_name AS student, st.student_no AS studentNo, p.fee_type AS feeType,
                                 p.method, p.amount, p.paid_at AS at, p.status
                          FROM payments p JOIN students st ON st.id = p.student_id ORDER BY p.paid_at DESC, p.id DESC LIMIT 6'),
    ]);
});

route('GET', '/cashier/students', function () {
    requireRole('cashier');
    $s = trim($_GET['q'] ?? '');
    if ($s === '') fail('Enter a student number or name.');
    $found = rows('SELECT * FROM students WHERE student_no LIKE ? OR full_name LIKE ? ORDER BY student_no LIMIT 6', [like($s), like($s)]);
    out(['items' => array_map('studentFinance', $found)]);
});

route('POST', '/cashier/payments', function () {
    $u = requireRole('cashier');
    $s = row('SELECT * FROM students WHERE id = ?', [(int)(body()['studentId'] ?? 0)]);
    if (!$s) fail('Select a student first.');
    $fee = str('feeType', 60); $method = str('method', 20); $ref = str('reference', 60);
    $amount = round((float)(body()['amount'] ?? 0), 2);
    if ($fee === '') fail('Select what the payment is for.');
    if (!in_array($method, ['Cash', 'GCash', 'Bank Transfer'], true)) fail('Payment method must be Cash, GCash or Bank.');
    if ($method !== 'Cash' && $ref === '') fail('A reference number is required for GCash and Bank payments.');
    if ($amount <= 0) fail('Enter an amount greater than zero.');
    $due = balanceDue($s['id']);
    if ($amount > $due) fail('Amount exceeds the outstanding balance of ₱' . number_format($due, 2) . '.');
    db()->beginTransaction();
    $n = (int)val('SELECT COUNT(*) FROM payments WHERE student_id = ? AND or_number IS NOT NULL', [$s['id']]) + 1;
    $or = sprintf('OR-%s-%s-%02d', date('Y'), substr(preg_replace('/\D/', '', $s['student_no']), -5), $n);
    $txn = sprintf('TXN-%04d', (int)val('SELECT COALESCE(MAX(id),0) FROM payments') + 1000);
    q('INSERT INTO payments (txn_ref, or_number, student_id, cashier_id, fee_type, method, reference_no, amount, status)
       VALUES (?,?,?,?,?,?,?,?,?)', [$txn, $or, $s['id'], $u['id'], $fee, $method, $ref ?: null, $amount, 'Paid']);
    q('UPDATE student_balances SET amount_paid = amount_paid + ? WHERE student_id = ?', [$amount, $s['id']]);
    db()->commit();
    logActivity($u['id'], "recorded a payment ($or)");
    if ($s['user_id']) notify($s['user_id'], "Payment of ₱" . number_format($amount, 2) . " received. Official receipt $or.");
    out(['ok' => true, 'orNumber' => $or, 'student' => studentFinance(row('SELECT * FROM students WHERE id = ?', [$s['id']]))], 201);
});

function rangeClause(): array {
    $r = $_GET['range'] ?? 'month';
    return match ($r) {
        'today' => ['DATE(p.paid_at) = CURDATE()', []],
        'week' => ['YEARWEEK(p.paid_at, 1) = YEARWEEK(CURDATE(), 1)', []],
        'month' => ['YEAR(p.paid_at) = YEAR(CURDATE()) AND MONTH(p.paid_at) = MONTH(CURDATE())', []],
        'custom' => ['DATE(p.paid_at) BETWEEN ? AND ?', [$_GET['from'] ?? '1970-01-01', $_GET['to'] ?? '2999-12-31']],
        default => ['1=1', []],
    };
}

route('GET', '/cashier/receipts', function () {
    requireRole('cashier');
    [$p, $per, $off] = page();
    [$rc, $ra] = rangeClause();
    $w = ["p.or_number IS NOT NULL", $rc]; $a = $ra;
    if (($s = trim($_GET['q'] ?? '')) !== '') { $w[] = '(p.or_number LIKE ? OR st.full_name LIKE ? OR st.student_no LIKE ?)'; array_push($a, like($s), like($s), like($s)); }
    $where = implode(' AND ', $w);
    $total = (int)val("SELECT COUNT(*) FROM payments p JOIN students st ON st.id = p.student_id WHERE $where", $a);
    $items = rows("SELECT p.or_number AS orNumber, st.full_name AS student, st.student_no AS studentNo, st.program, st.year_level AS yearLevel,
                          p.amount, p.paid_at AS date, u.full_name AS cashier
                   FROM payments p JOIN students st ON st.id = p.student_id JOIN users u ON u.id = p.cashier_id
                   WHERE $where ORDER BY p.paid_at DESC, p.id DESC LIMIT $per OFFSET $off", $a);
    out(['items' => $items, 'total' => $total, 'page' => $p, 'per' => $per]);
});

route('GET', '/cashier/receipts/:or', function ($r) {
    requireRole('cashier');
    $p = row('SELECT p.*, st.full_name, st.student_no, st.program_name, st.year_level, st.id AS sid, u.full_name AS cashier
              FROM payments p JOIN students st ON st.id = p.student_id JOIN users u ON u.id = p.cashier_id WHERE p.or_number = ?', [$r['or']]);
    if (!$p) fail('Receipt not found.', 404);
    out(['receipt' => [
        'orNumber' => $p['or_number'], 'date' => $p['paid_at'], 'student' => $p['full_name'], 'studentNo' => $p['student_no'],
        'course' => $p['program_name'] . ', Year ' . $p['year_level'], 'feeType' => $p['fee_type'], 'method' => $p['method'],
        'reference' => $p['reference_no'], 'amount' => (float)$p['amount'], 'remaining' => balanceDue($p['sid']), 'cashier' => $p['cashier'],
    ]]);
});
