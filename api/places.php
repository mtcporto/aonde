<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$envPath = dirname(__DIR__) . '/.env.local';
$dbUrl = '';
$dbToken = '';

if (file_exists($envPath)) {
    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        $parts = explode('=', $line, 2);
        if (count($parts) === 2) {
            $k = trim($parts[0]);
            $v = trim($parts[1]);
            if ($k === 'TURSO_DATABASE_URL') $dbUrl = $v;
            if ($k === 'TURSO_AUTH_TOKEN') $dbToken = $v;
        }
    }
}

if (!$dbUrl || !$dbToken) {
    http_response_code(503);
    echo json_encode(['error' => 'Turso credentials not configured']);
    exit;
}

$hostname = preg_replace('#^libsql://#', '', $dbUrl);
$pipelineUrl = "https://{$hostname}/v2/pipeline";

$idParam = isset($_GET['id']) ? trim($_GET['id']) : '';

if ($idParam !== '') {
    $stmt = [
        'sql' => 'SELECT * FROM places WHERE id = ? OR CAST(numeric_id AS TEXT) = ? LIMIT 1',
        'args' => [
            ['type' => 'text', 'value' => $idParam],
            ['type' => 'text', 'value' => $idParam]
        ]
    ];
} else {
    $stmt = [
        'sql' => 'SELECT * FROM places ORDER BY name ASC',
        'args' => []
    ];
}

$payload = json_encode([
    'requests' => [
        ['type' => 'execute', 'stmt' => $stmt],
        ['type' => 'close']
    ]
]);

$ch = curl_init($pipelineUrl);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer {$dbToken}",
        "Content-Type: application/json"
    ],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 6
]);

$raw = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($raw === false || $httpCode >= 400) {
    http_response_code(502);
    echo json_encode(['error' => 'Failed to query Turso', 'status' => $httpCode]);
    exit;
}

$data = json_decode($raw, true);
$result = $data['results'][0]['response']['result'] ?? null;
if (!$result) {
    http_response_code(500);
    echo json_encode(['error' => 'Invalid Turso response']);
    exit;
}

$cols = array_map(fn($c) => $c['name'], $result['cols'] ?? []);
$items = [];

foreach ($result['rows'] ?? [] as $row) {
    $assoc = [];
    foreach ($cols as $idx => $colName) {
        $cell = $row[$idx] ?? ['type' => 'null'];
        if ($cell['type'] === 'null') {
            $assoc[$colName] = null;
        } elseif ($cell['type'] === 'integer') {
            $assoc[$colName] = (int)$cell['value'];
        } elseif ($cell['type'] === 'float') {
            $assoc[$colName] = (float)$cell['value'];
        } else {
            $assoc[$colName] = $cell['value'] ?? '';
        }
    }

    $feat = json_decode($assoc['features_json'] ?? '{}', true) ?: [
        'accessible' => (bool)$assoc['feat_accessible'],
        'petFriendly' => (bool)$assoc['feat_pet_friendly'],
        'kidsSpace' => (bool)$assoc['feat_kids_space'],
        'parking' => (bool)$assoc['feat_parking'],
        'wifi' => (bool)$assoc['feat_wifi'],
        'pool' => (bool)$assoc['feat_pool'],
    ];

    $kind = $assoc['kind'] === 'hotel' ? 'hotel' : 'restaurante';
    $items[] = [
        'id' => $assoc['numeric_id'],
        'slugId' => $assoc['id'],
        'kind' => $kind,
        'name' => $assoc['name'],
        'tier' => $assoc['tier'],
        'price' => $assoc['price'],
        'type' => $assoc['type_slug'],
        'typeLabel' => $assoc['category'],
        'category' => $kind === 'hotel' ? $assoc['type_slug'] : null,
        'categoryLabel' => $kind === 'hotel' ? $assoc['category'] : null,
        'neighborhood' => $assoc['neighborhood'],
        'address' => $assoc['address'],
        'lat' => (float)$assoc['lat'],
        'lon' => (float)$assoc['lon'],
        'hours' => $assoc['hours'],
        'checkin' => $assoc['checkin'] ?: null,
        'checkout' => $assoc['checkout'] ?: null,
        'phone' => $assoc['phone'] ?: null,
        'instagram' => $assoc['instagram'] ?: null,
        'website' => $assoc['website'] ?: null,
        'image' => $assoc['image'],
        'statusNote' => $assoc['status_note'] ?: null,
        'description' => $assoc['description'],
        'feat' => $feat
    ];
}

echo json_encode([
    'source' => 'turso',
    'database' => $hostname,
    'total' => count($items),
    'items' => $items
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
