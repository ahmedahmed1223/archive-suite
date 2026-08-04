<?php

/**
 * V1-X02 live ODBC driver.
 *
 * Exercises the product ODBC classes (OdbcConnectionProbe, NativeOdbcConnection)
 * against a real database over a real driver, and emits JSON on stdout. Errors
 * pass through redact() so a DSN password never reaches the evidence file.
 *
 * Usage: php x02-odbc.php <probe|allowlisted|denied>
 */

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Services\Odbc\NativeOdbcConnectionFactory;
use App\Services\Odbc\OdbcConnectionProbe;

const ALLOWED_TABLE = 'allowed_media';
const DENIED_TABLE = 'denied_secrets';

function redact(string $text): string
{
    foreach (['ODBC_PASSWORD', 'ODBC_USERNAME'] as $name) {
        $value = (string) env($name, '');
        if (strlen($value) >= 4) {
            $text = str_replace($value, '[REDACTED]', $text);
        }
    }

    return preg_replace('/(PWD|Password|UID)=[^;]+/i', '$1=[REDACTED]', $text) ?? $text;
}

function emit(array $payload): void
{
    echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";
}

function connect()
{
    return (new NativeOdbcConnectionFactory())->connect(
        (string) config('odbc.dsn'),
        config('odbc.username'),
        config('odbc.password'),
    );
}

$phase = $argv[1] ?? 'probe';

try {
    if ($phase === 'probe') {
        $probe = new OdbcConnectionProbe(new NativeOdbcConnectionFactory(), config('odbc'));
        $result = $probe->probe();
        $tables = $result['tables'] ?? [];
        emit([
            'phase' => 'probe',
            'ok' => ($result['status'] ?? '') === 'connected' && in_array(ALLOWED_TABLE, $tables, true),
            'status' => $result['status'] ?? null,
            'driverLoaded' => $result['driverLoaded'] ?? null,
            'extensionLoaded' => function_exists('odbc_connect'),
            'tablesVisible' => count($tables),
            'allowedTableVisible' => in_array(ALLOWED_TABLE, $tables, true),
            // The probe masks the DSN itself; confirm no raw password survives.
            'dsnMasked' => ! str_contains(strtolower((string) ($result['dsn'] ?? '')), 'pwd='.strtolower((string) config('odbc.password'))),
        ]);
        exit(0);
    }

    if ($phase === 'allowlisted') {
        $connection = connect();
        $before = $connection->readRows(ALLOWED_TABLE, 0, 50);
        $inserted = $connection->insertRow(ALLOWED_TABLE, ['title' => 'x02-live-insert']);
        $after = $connection->readRows(ALLOWED_TABLE, 0, 50);
        $titles = array_map(static fn (array $row): string => (string) ($row['title'] ?? ''), $after);
        $newRow = array_values(array_filter($after, static fn (array $row): bool => ($row['title'] ?? '') === 'x02-live-insert'));
        $deleted = $newRow !== [] ? $connection->deleteRow(ALLOWED_TABLE, 'id', $newRow[0]['id']) : 0;
        $final = $connection->readRows(ALLOWED_TABLE, 0, 50);
        emit([
            'phase' => 'allowlisted',
            'ok' => $inserted === 1
                && count($after) === count($before) + 1
                && in_array('x02-live-insert', $titles, true)
                && $deleted === 1
                && count($final) === count($before),
            'rowsBefore' => count($before),
            'insertedRows' => $inserted,
            'rowsAfterInsert' => count($after),
            'deletedRows' => $deleted,
            'rowsAfterDelete' => count($final),
        ]);
        exit(0);
    }

    // The role has no grant on this table. A refusal is the pass condition;
    // returning rows would mean provider-side authorization is not enforced.
    if ($phase === 'denied') {
        $connection = connect();
        $refused = false;
        $rows = null;
        $error = '';
        try {
            $rows = $connection->readRows(DENIED_TABLE, 0, 10);
        } catch (Throwable $e) {
            $refused = true;
            $error = redact($e->getMessage());
        }
        emit([
            'phase' => 'denied',
            'ok' => $refused || $rows === [] || $rows === null,
            'refused' => $refused,
            'rowsReturned' => is_array($rows) ? count($rows) : null,
            'error' => mb_substr($error, 0, 300),
        ]);
        exit(0);
    }

    emit(['phase' => $phase, 'ok' => false, 'error' => 'unknown phase']);
    exit(2);
} catch (Throwable $e) {
    emit(['phase' => $phase, 'ok' => false, 'error' => mb_substr(redact($e->getMessage()), 0, 300)]);
    exit(1);
}
