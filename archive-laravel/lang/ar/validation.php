<?php

// V1-823: Arabic translation for Laravel's framework validation messages.
// Scoped to the rules actually used across app/Http/Controllers/Api/V1 and
// app/Http/Requests (checked with a repo-wide grep before writing this), not
// a full translation of Laravel's ~90-key default file. Any rule not listed
// here falls back to English via config('app.fallback_locale') rather than
// showing a missing-translation key, so adding a new rule to a controller
// degrades safely instead of breaking.
return [

    'required' => 'حقل :attribute مطلوب.',
    'string' => 'يجب أن يكون حقل :attribute نصاً.',
    'array' => 'يجب أن يكون حقل :attribute مصفوفة.',
    'integer' => 'يجب أن يكون حقل :attribute رقماً صحيحاً.',
    'numeric' => 'يجب أن يكون حقل :attribute رقماً.',
    'boolean' => 'يجب أن تكون قيمة حقل :attribute صحيحة أو خاطئة.',
    'email' => 'يجب أن يكون حقل :attribute بريداً إلكترونياً صالحاً.',
    'url' => 'يجب أن يكون حقل :attribute رابطاً صالحاً.',
    'file' => 'يجب أن يكون حقل :attribute ملفاً.',
    'image' => 'يجب أن يكون حقل :attribute صورة.',
    'date' => 'يجب أن يكون حقل :attribute تاريخاً صالحاً.',
    'date_format' => 'يجب أن يطابق حقل :attribute الصيغة :format.',
    'after' => 'يجب أن يكون حقل :attribute تاريخاً بعد :date.',
    'different' => 'يجب أن يختلف حقل :attribute عن :other.',
    'json' => 'يجب أن يكون حقل :attribute نص JSON صالحاً.',
    'in' => 'القيمة المختارة لحقل :attribute غير صالحة.',
    'regex' => 'صيغة حقل :attribute غير صالحة.',

    'max' => [
        'array' => 'يجب ألا يحتوي حقل :attribute على أكثر من :max عناصر.',
        'file' => 'يجب ألا يتجاوز حجم حقل :attribute :max كيلوبايت.',
        'numeric' => 'يجب ألا تتجاوز قيمة حقل :attribute :max.',
        'string' => 'يجب ألا يتجاوز حقل :attribute :max حرفاً.',
    ],

    'min' => [
        'array' => 'يجب أن يحتوي حقل :attribute على :min عناصر على الأقل.',
        'file' => 'يجب ألا يقل حجم حقل :attribute عن :min كيلوبايت.',
        'numeric' => 'يجب ألا تقل قيمة حقل :attribute عن :min.',
        'string' => 'يجب ألا يقل حقل :attribute عن :min حرفاً.',
    ],

    'size' => [
        'array' => 'يجب أن يحتوي حقل :attribute على :size عناصر.',
        'file' => 'يجب أن يكون حجم حقل :attribute :size كيلوبايت.',
        'numeric' => 'يجب أن تكون قيمة حقل :attribute :size.',
        'string' => 'يجب أن يكون حقل :attribute :size حرفاً.',
    ],

    'gt' => [
        'array' => 'يجب أن يحتوي حقل :attribute على أكثر من :value عناصر.',
        'file' => 'يجب أن يتجاوز حجم حقل :attribute :value كيلوبايت.',
        'numeric' => 'يجب أن تتجاوز قيمة حقل :attribute :value.',
        'string' => 'يجب أن يتجاوز حقل :attribute :value حرفاً.',
    ],

];
