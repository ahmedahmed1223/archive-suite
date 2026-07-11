<?php

return [
    'runtimePolicy' => [
        'mode' => 'catalog-only',
        'allowsRemoteInstall' => false,
        'allowsCodeExecution' => false,
        'requiresAdminReview' => true,
        'description' => 'Masar exposes a reviewed plugin catalog and permission model only. Installing or executing third-party plugin code is intentionally outside this local runtime.',
    ],
    'plugins' => [
        [
            'id' => 'metadata-quality-assistant',
            'name' => 'مساعد جودة البيانات الوصفية',
            'vendor' => 'Masar Labs',
            'version' => '0.1.0',
            'category' => 'metadata',
            'summary' => 'يقترح حقولاً ناقصة ووسوماً تنظيمية اعتماداً على بيانات الأرشيف الحالية.',
            'status' => 'reviewed',
            'trustLevel' => 'internal',
            'permissions' => [
                ['scope' => 'records:read', 'risk' => 'low', 'reason' => 'قراءة عناوين ووصف ووسوم السجلات لتوليد اقتراحات.'],
                ['scope' => 'suggestions:write', 'risk' => 'medium', 'reason' => 'إنشاء اقتراحات قابلة للمراجعة ولا تعدّل السجلات مباشرة.'],
            ],
            'securityReview' => [
                'networkAccess' => false,
                'fileSystemAccess' => false,
                'executesCode' => false,
                'dataLeavesTenant' => false,
                'adminApprovalRequired' => true,
            ],
        ],
        [
            'id' => 'broadcast-review-pack',
            'name' => 'حزمة مراجعة البث',
            'vendor' => 'Masar Labs',
            'version' => '0.1.0',
            'category' => 'workflow',
            'summary' => 'قوالب تشغيل لمراجعة البث، الملاحظات الزمنية، والراندون.',
            'status' => 'reviewed',
            'trustLevel' => 'internal',
            'permissions' => [
                ['scope' => 'media:read', 'risk' => 'low', 'reason' => 'قراءة معرف المادة والزمن الحالي للمراجعة.'],
                ['scope' => 'collaboration:write', 'risk' => 'medium', 'reason' => 'إضافة ملاحظات وراندون داخل غرفة التعاون.'],
            ],
            'securityReview' => [
                'networkAccess' => false,
                'fileSystemAccess' => false,
                'executesCode' => false,
                'dataLeavesTenant' => false,
                'adminApprovalRequired' => true,
            ],
        ],
        [
            'id' => 'external-ai-enrichment',
            'name' => 'إثراء AI خارجي',
            'vendor' => 'Partner ecosystem',
            'version' => 'proposal',
            'category' => 'ai',
            'summary' => 'نمط مقترح لإثراء الرؤية والكيانات عبر مزود خارجي بعد مراجعة قانونية وأمنية.',
            'status' => 'blocked',
            'trustLevel' => 'external',
            'permissions' => [
                ['scope' => 'records:read', 'risk' => 'medium', 'reason' => 'يحتاج قراءة محتوى/metadata لإنتاج الإثراء.'],
                ['scope' => 'network:external', 'risk' => 'high', 'reason' => 'يرسل بيانات إلى مزود خارجي؛ محظور حتى اعتماد DPA وسياسة بيانات.'],
            ],
            'securityReview' => [
                'networkAccess' => true,
                'fileSystemAccess' => false,
                'executesCode' => false,
                'dataLeavesTenant' => true,
                'adminApprovalRequired' => true,
            ],
        ],
    ],
];
