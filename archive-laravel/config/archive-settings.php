<?php

$settings = [
    'schema_version' => 1,

    // Only capabilities that have working server-side surfaces belong here.
    // Deferred roadmap items deliberately have no settings keys.
    'capabilities' => [
        'systemControl' => [
            'type' => 'boolean', 'scope' => 'system', 'default' => true,
            'userOverridable' => false, 'roles' => ['admin'], 'requiresCapability' => null,
            'securitySensitive' => true, 'introducedIn' => '1.3',
            'source' => 'deployment', 'config' => 'archive.system_control_enabled',
            'adminEditable' => true, 'unavailableStatus' => 'unavailable',
            'unavailableReason' => 'Host control is disabled by deployment configuration.',
        ],
        'backups' => [
            'type' => 'boolean', 'scope' => 'system', 'default' => true,
            'userOverridable' => false, 'roles' => ['admin'], 'requiresCapability' => null,
            'securitySensitive' => true, 'introducedIn' => '1.3',
            'source' => 'release', 'adminEditable' => false,
        ],
        'trash' => [
            'type' => 'boolean', 'scope' => 'system', 'default' => true,
            'userOverridable' => false, 'roles' => ['admin', 'editor'], 'requiresCapability' => null,
            'securitySensitive' => true, 'introducedIn' => '1.3',
            'source' => 'release', 'adminEditable' => false,
        ],
        'odbc' => [
            'type' => 'boolean', 'scope' => 'system', 'default' => true,
            'userOverridable' => false, 'roles' => ['admin'], 'requiresCapability' => null,
            'securitySensitive' => true, 'introducedIn' => '1.3',
            'source' => 'deployment', 'config' => 'archive.features.odbc',
            'adminEditable' => true, 'unavailableStatus' => 'unavailable',
            'unavailableReason' => 'ODBC is disabled by deployment configuration.',
        ],
        'broadcastMetadata' => [
            'type' => 'boolean', 'scope' => 'system', 'default' => true,
            'userOverridable' => false, 'roles' => ['admin', 'editor'], 'requiresCapability' => null,
            'securitySensitive' => false, 'introducedIn' => '1.3',
            'source' => 'deployment', 'config' => 'archive.features.broadcast_metadata',
            'adminEditable' => true, 'unavailableStatus' => 'unavailable',
            'unavailableReason' => 'Broadcast metadata is disabled by deployment configuration.',
        ],
        'semanticSearch' => [
            'type' => 'boolean', 'scope' => 'system', 'default' => false,
            'userOverridable' => false, 'roles' => ['admin', 'editor', 'viewer'], 'requiresCapability' => null,
            'securitySensitive' => false, 'introducedIn' => '1.2',
            'source' => 'deployment', 'config' => 'embeddings.enabled',
            'adminEditable' => false, 'unavailableStatus' => 'needs_configuration',
            'unavailableReason' => 'Semantic search requires PostgreSQL, pgvector, and an embeddings provider.',
        ],
        'mediaProcessing' => [
            'type' => 'boolean', 'scope' => 'system', 'default' => false,
            'userOverridable' => false, 'roles' => ['admin', 'editor'], 'requiresCapability' => null,
            'securitySensitive' => false, 'introducedIn' => '1.0',
            'source' => 'deployment', 'config' => 'media.processor', 'enabledValue' => 'real',
            'adminEditable' => false, 'unavailableStatus' => 'needs_configuration',
            'unavailableReason' => 'Real media processing requires the media profile and worker tools.',
        ],
        'ocr' => [
            'type' => 'boolean', 'scope' => 'system', 'default' => false,
            'userOverridable' => false, 'roles' => ['admin', 'editor'], 'requiresCapability' => 'mediaProcessing',
            'securitySensitive' => false, 'introducedIn' => '1.0',
            'source' => 'deployment', 'config' => 'media.ocr_service_url', 'nonEmpty' => true,
            'adminEditable' => false, 'unavailableStatus' => 'needs_configuration',
            'unavailableReason' => 'OCR requires real media processing and the OCR service.',
        ],
        'mcp' => [
            'type' => 'boolean', 'scope' => 'system', 'default' => true,
            'userOverridable' => false, 'roles' => ['admin', 'editor', 'viewer'], 'requiresCapability' => null,
            'securitySensitive' => true, 'introducedIn' => '1.2',
            'source' => 'release', 'adminEditable' => false,
        ],
    ],

    'experience' => [
        'locale' => [
            'type' => 'enum', 'scope' => 'user', 'default' => 'ar', 'values' => ['ar', 'en'],
            'validation' => ['string', 'in:ar,en'],
        ],
        'timeZone' => [
            'type' => 'string', 'scope' => 'user', 'default' => 'Europe/Istanbul',
            'validation' => ['string', 'timezone:all'],
        ],
        'dateFormat' => [
            'type' => 'enum', 'scope' => 'user', 'default' => 'DD/MM/YYYY',
            'values' => ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'],
            'validation' => ['string', 'in:DD/MM/YYYY,MM/DD/YYYY,YYYY-MM-DD'],
        ],
        'timeFormat' => [
            'type' => 'enum', 'scope' => 'user', 'default' => '24h', 'values' => ['24h', '12h'],
            'validation' => ['string', 'in:24h,12h'],
        ],
        'theme' => [
            'type' => 'enum', 'scope' => 'user', 'default' => 'cinematic-dark',
            'values' => ['cinematic-dark', 'luxury-dark', 'ocean-dark', 'neutral-light', 'high-contrast'],
            'validation' => ['string', 'in:cinematic-dark,luxury-dark,ocean-dark,neutral-light,high-contrast'],
        ],
        'density' => [
            'type' => 'enum', 'scope' => 'user', 'default' => 'comfortable',
            'values' => ['comfortable', 'compact'], 'validation' => ['string', 'in:comfortable,compact'],
        ],
        'textScale' => [
            'type' => 'enum', 'scope' => 'user', 'default' => 'medium',
            'values' => ['small', 'medium', 'large'], 'validation' => ['string', 'in:small,medium,large'],
        ],
        'reducedMotion' => [
            'type' => 'boolean', 'scope' => 'user', 'default' => false, 'validation' => ['boolean'],
        ],
        'homePage' => [
            'type' => 'string', 'scope' => 'user', 'default' => '/',
            'validation' => ['string', 'max:255', 'regex:/^\/[A-Za-z0-9_\-\/.]*$/'],
        ],
        'navigation' => [
            'type' => 'object', 'scope' => 'user',
            'default' => ['order' => [], 'hiddenModules' => []],
            'validation' => ['array:order,hiddenModules'],
            'nestedValidation' => [
                'navigation.order' => ['sometimes', 'array'],
                'navigation.order.*' => ['string', 'max:100', 'distinct'],
                'navigation.hiddenModules' => ['sometimes', 'array'],
                'navigation.hiddenModules.*' => ['string', 'max:100', 'distinct'],
            ],
        ],
        'views' => [
            'type' => 'object', 'scope' => 'user',
            'default' => ['archive' => ['mode' => 'table', 'pageSize' => 25, 'columns' => [], 'defaultSavedSearchId' => null]],
            'validation' => ['array:archive'],
            'nestedValidation' => [
                'views.archive' => ['sometimes', 'array:mode,pageSize,columns,defaultSavedSearchId'],
                'views.archive.mode' => ['sometimes', 'string', 'in:table,grid'],
                'views.archive.pageSize' => ['sometimes', 'integer', 'min:1', 'max:200'],
                'views.archive.columns' => ['sometimes', 'array'],
                'views.archive.columns.*' => ['string', 'max:100', 'distinct'],
                'views.archive.defaultSavedSearchId' => ['sometimes', 'nullable', 'string', 'max:255'],
            ],
        ],
        'shortcuts' => [
            'type' => 'object', 'scope' => 'user',
            'default' => [
                'playPause' => 'Space',
                'seekForward' => 'ArrowRight',
                'seekBackward' => 'ArrowLeft',
                'nextComment' => 'N',
                'previousComment' => 'P',
            ],
            'validation' => ['array:playPause,seekForward,seekBackward,nextComment,previousComment'],
            'nestedValidation' => [
                'shortcuts.playPause' => ['sometimes', 'string', 'max:64'],
                'shortcuts.seekForward' => ['sometimes', 'string', 'max:64'],
                'shortcuts.seekBackward' => ['sometimes', 'string', 'max:64'],
                'shortcuts.nextComment' => ['sometimes', 'string', 'max:64'],
                'shortcuts.previousComment' => ['sometimes', 'string', 'max:64'],
            ],
        ],
        'notifications' => [
            'type' => 'object', 'scope' => 'user',
            'default' => ['dailyDigest' => false, 'optional' => []],
            'validation' => ['array:dailyDigest,optional'],
            'nestedValidation' => [
                'notifications.dailyDigest' => ['sometimes', 'boolean'],
                'notifications.optional' => ['sometimes', 'array'],
                'notifications.optional.*' => ['string', 'in:reviewAssigned,commentMentioned,taskAssigned,rightsExpiring,mediaJobCompleted,taskDueSoon', 'distinct'],
            ],
        ],
        'studioLayout' => [
            'type' => 'object', 'scope' => 'user',
            'default' => ['comments' => 'right', 'transcript' => 'left', 'timelineHeight' => 240, 'panels' => []],
            'validation' => ['array:comments,transcript,timelineHeight,panels'],
            'nestedValidation' => [
                'studioLayout.comments' => ['sometimes', 'string', 'in:left,right,hidden'],
                'studioLayout.transcript' => ['sometimes', 'string', 'in:left,right,hidden'],
                'studioLayout.timelineHeight' => ['sometimes', 'integer', 'min:160', 'max:720'],
                'studioLayout.panels' => ['sometimes', 'array'],
                'studioLayout.panels.*' => ['string', 'in:comments,transcript,timeline,metadata', 'distinct'],
            ],
        ],
    ],
];

foreach ($settings['capabilities'] as $key => $definition) {
    $settings['capabilities'][$key] = ['key' => $key, ...$definition];
}

foreach ($settings['experience'] as $key => $definition) {
    $settings['experience'][$key] = [
        'key' => $key,
        'userOverridable' => true,
        'roles' => ['admin', 'editor', 'viewer'],
        'requiresCapability' => null,
        'securitySensitive' => false,
        'introducedIn' => '1.3',
        ...$definition,
    ];
}

return $settings;
