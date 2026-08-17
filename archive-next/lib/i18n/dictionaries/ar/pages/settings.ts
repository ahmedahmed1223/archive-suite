export const settings = {
  legacyTools: {
    ariaLabel: "أدوات تشغيلية متقدمة",
    heading: "أدوات تشغيلية متقدمة",
    description: "تشخيص الأمان وODBC ومعالجة Whisper واختبارات الاتصال، لا تزال خارج نطاق مركز الإعدادات الموحّد أعلاه."
  },
  toolbar: {
    eyebrow: "مركز الإعدادات",
    title: "إعدادات {brand}",
    description: "مركز واحد للهوية، الأمان، التخزين، ODBC، API، والمظهر، مع تمييز ما هو مطبق فعلاً وما ينتظر صلاحيات تحرير أو دعم خلفي إضافي.",
    metaIdentity: "هوية النظام",
    metaSecurity: "أمان",
    metaMonitoring: "مراقبة",
    usersAndRoles: "المستخدمون والأدوار",
    reopenTour: "إعادة فتح الجولة",
    systemStatus: "حالة النظام",
    errorLog: "سجل الأخطاء"
  },
  setupBanner: {
    ariaLabel: "رحلة الإعداد",
    stepTitle: "الخطوة الحالية: مراجعة إعدادات التشغيل",
    description: "نفّذ اختبارات التخزين وقاعدة البيانات أدناه، ثم راجع حالة النظام لتحديد الإجراء التالي.",
    continueReadiness: "متابعة الجاهزية",
    viewTour: "عرض رحلة الإعداد"
  },
  metrics: {
    ariaLabel: "ملخص الإعدادات",
    identityLabel: "الهوية",
    securityLabel: "الأمان",
    checking: "جار الفحص",
    needsReview: "يتطلب مراجعة",
    loaded: "محمّل",
    securityDescriptionRate: "{rate} طلب/دقيقة",
    securityDescriptionReadOnly: "إعدادات القراءة",
    odbcDescriptionTablesVisible: "{count} جدول مرئي",
    odbcDescriptionLegacy: "ربط الأنظمة القديمة",
    notAvailable: "غير متاح",
    writeLabel: "الكتابة",
    writeRestricted: "مقيدة",
    writeClosed: "مغلقة",
    writeDescriptionTable: "الجدول المحدد: {table}"
  },
  identity: {
    ariaLabel: "هوية النظام",
    heading: "هوية النظام",
    descriptionTemplate: "{descriptor} باسم عربي أساسي واسم لاتيني داعم للاستخدامات التقنية."
  },
  categories: {
    ariaLabel: "فئات الإعدادات",
    system: {
      title: "النظام",
      summary: "تجميع إعدادات البيئة العامة والاحتفاظ التشغيلي في وضع قراءة فقط.",
      items: ["المنطقة الزمنية: Europe/Istanbul", "الاحتفاظ: وفق السياسة"]
    },
    storage: {
      title: "التخزين",
      summary: "مؤشرات التخزين تشرح مكان البيانات وحدودها من دون أدوات تحرير.",
      items: ["المخزن الرئيسي: تخزين كائني", "النسخ الاحتياطي: مجدول", "الحصة: تحت المراقبة"]
    },
    api: {
      title: "واجهة API",
      summary: "ملخص طبقة التكامل مع العقد والقيود والاعتمادية التي تعتمد عليها الواجهة.",
      items: ["الإصدار: v1", "المصادقة: رمز قصير + تحديث آمن", "حدود الطلب: مفعلة"]
    },
    appearance: {
      title: "المظهر",
      summary: "هوية العرض والنسق المرئي الحاليان موثقان هنا للرجوع السريع.",
      items: ["النسق: فاتح", "الكثافة: مدمجة"],
      identityItemTemplate: "الهوية: {brand}"
    }
  },
  security: {
    ariaLabel: "وضع الأمان",
    heading: "وضع الأمان",
    description: "ملخص للقراءة فقط يوضح سياسة الوصول الحالية والضوابط المطبقة.",
    needsReview: "يتطلب مراجعة",
    readOnly: "قراءة فقط",
    loading: "جاري تحميل إعدادات الأمان...",
    errorPrefix: "خطأ: {error}",
    postureAriaLabel: "ضوابط الأمان الحالية",
    accessTokenTtl: "مدة رمز الوصول",
    accessTokenTtlValue: "{minutes} دقيقة",
    rateLimit: "حد الطلبات لكل دقيقة",
    rateLimitValue: "{limit} طلب",
    legacyPasswordUpgrade: "ترقية كلمات المرور القديمة",
    enabled: "مفعلة",
    disabled: "معطلة",
    webhookAllowlist: "قائمة Webhook المسموحة",
    webhookAllowlistValue: "{count} رابط",
    webhookAllowlistEmpty: "فارغة",
    whisperProcessorLabel: "معالج Whisper",
    whisperGpu: "GPU (CUDA)",
    whisperCpu: "CPU",
    cspHeading: "سياسة CSP (وقت النشر)",
    corsHeading: "مصادر CORS (وقت النشر)",
    loadError: "تعذر تحميل إعدادات الأمان.",
    loadConnectionError: "تعذر الاتصال بالخادم لجلب الإعدادات."
  },
  display: {
    ariaLabel: "إعدادات التاريخ والوقت",
    heading: "التاريخ والوقت",
    description: "إعداد مركزي يحدد طريقة عرض التاريخ والوقت لجميع المستخدمين، من دون تغيير التواريخ المخزنة.",
    loading: "جارٍ تحميل إعداد التاريخ والوقت...",
    fallback: "تعذر تحميل الإعداد؛ يجري استخدام التنسيق الافتراضي مؤقتًا.",
    timeZoneLabel: "المنطقة الزمنية",
    timeZoneHint: "اكتب اسم منطقة زمنية بصيغة IANA، مثل Europe/Istanbul.",
    dateFormatLabel: "تنسيق التاريخ",
    timeFormatLabel: "تنسيق الوقت",
    dateFormatDayFirst: "يوم/شهر/سنة",
    dateFormatMonthFirst: "شهر/يوم/سنة",
    dateFormatYearFirst: "سنة-شهر-يوم",
    timeFormat24: "24 ساعة",
    timeFormat12: "12 ساعة",
    showSecondsLabel: "إظهار الثواني",
    previewLabel: "معاينة",
    readOnly: "يمكنك عرض التنسيق المطبق. تعديل هذا الإعداد متاح للمدير فقط.",
    save: "حفظ إعداد التاريخ والوقت",
    saving: "جارٍ الحفظ...",
    saveSuccess: "تم حفظ إعداد التاريخ والوقت لجميع المستخدمين.",
    saveError: "تعذر حفظ إعداد التاريخ والوقت.",
    saveConnectionError: "تعذر الاتصال بالخادم لحفظ إعداد التاريخ والوقت."
  },
  whisper: {
    ariaLabel: "إعداد معالجة Whisper",
    heading: "معالجة Whisper",
    description: "اختر المعالج الذي تستخدمه مهام تفريغ الصوت والفيديو الجديدة. المعالج المركزي هو الإعداد الافتراضي.",
    loading: "جاري تحميل إعداد Whisper...",
    processorLabel: "المعالج",
    cpuOption: "CPU — الافتراضي",
    cudaOption: "GPU عبر CUDA",
    gpuHelperBefore: "يتطلب خيار GPU عامل",
    gpuHelperAfter: "يعمل مع CUDA وNVIDIA Container Toolkit. حفظ الخيار لا يثبت توفر GPU تلقائيًا؛ ستفشل المهمة برسالة واضحة إن لم يكن العامل جاهزًا.",
    saveError: "تعذر حفظ إعداد Whisper.",
    saveSuccess: "تم حفظ إعداد Whisper. سيُطبق على مهام التفريغ الجديدة.",
    saveConnectionError: "تعذر الاتصال بالخادم لحفظ إعداد Whisper.",
    loadError: "تعذر تحميل إعداد Whisper."
  },
  tips: {
    ariaLabel: "نصائح السياق",
    heading: "نصائح السياق",
    description: "زر المساعدة \"؟\" الذي يظهر في شريط أدوات كل صفحة، مع اقتراحات سريعة خاصة بها.",
    toggleLabel: "إظهار نصائح السياق في كل الصفحات",
    helper: "إعادة التفعيل تُظهر من جديد كل نصيحة أُخفيت سابقًا لهذه الجلسة أو نهائيًا."
  },
  odbc: {
    heading: "ODBC للأنظمة القديمة",
    description: "فحص الاتصال، معاينة قراءة محدودة، وكتابة صفوف مقيدة للجداول الأساسية المسموحة فقط.",
    loading: "جاري فحص ODBC...",
    errorPrefix: "خطأ: {error}",
    connectedTitle: "الاتصال جاهز",
    needsSetupTitle: "يتطلب إعداداً",
    statusLabel: "الحالة",
    driverLabel: "مشغّل ODBC",
    driverAvailable: "متاح",
    driverUnavailable: "غير متاح",
    dsnLabel: "DSN",
    dsnNotConfigured: "غير مضبوط",
    visibleTablesLabel: "الجداول المرئية",
    tableLabels: {
      items: "المواد",
      users: "المستخدمون",
      settings: "الإعدادات",
      audit: "التدقيق"
    },
    statusMap: {
      connected: "متصل",
      disabled: "معطل",
      missingDsn: "DSN مفقود",
      driverUnavailable: "المشغّل غير متاح",
      failed: "فشل الاتصال"
    },
    statusMessages: {
      disabled: "جسر ODBC معطل في بيئة الخادم.",
      missingDsn: "ODBC مفعل لكن قيمة ODBC_DSN فارغة.",
      driverUnavailable: "امتداد PHP ODBC أو مشغلات ODBC غير متاحة."
    },
    tableFieldLabel: "الجدول الأساسي",
    previewButtonLoading: "جاري القراءة",
    previewButton: "معاينة",
    previewDisabledHelper: "المعاينة تعمل بعد تفعيل ODBC وضبط DSN وتحميل المشغّل في بيئة الخادم.",
    writeSectionTitle: "كتابة صف مقيدة",
    writeSectionHelper: "تقبل العمليات كائن JSON فقط، وتمنع أعمدة الأسرار وكلمات المرور والرموز السرية.",
    operationLabel: "العملية",
    operationInsert: "إضافة صف",
    operationUpdate: "تحديث صف",
    operationDelete: "حذف صف",
    keyColumnLabel: "عمود المفتاح",
    keyValueLabel: "قيمة المفتاح",
    keyValuePlaceholder: "row id أو key",
    valuesJsonLabel: "القيم JSON",
    executeButtonSaving: "جار التنفيذ...",
    executeButton: "تنفيذ العملية",
    invalidJson: "اكتب القيم في كائن JSON صالح.",
    writeSuccess: "تم تنفيذ {operation} على {affected} صف.",
    writeError: "تعذر تنفيذ عملية ODBC.",
    previewErrorPrefix: "خطأ: {error}",
    previewRowCount: "{count} صف",
    previewEmpty: "لا توجد صفوف ضمن حد المعاينة الحالي.",
    loadStatusError: "تعذر تحميل حالة ODBC.",
    loadStatusConnectionError: "تعذر الاتصال بالخادم لجلب حالة ODBC.",
    loadPreviewError: "تعذر تحميل معاينة جدول ODBC.",
    loadPreviewConnectionError: "تعذر الاتصال بالخادم لمعاينة جدول ODBC."
  },
  connectionTest: {
    heading: "فحص الاتصالات",
    description: "نفّذ فحصاً آمناً للقراءة والكتابة ثم راجع النتيجة قبل الاعتماد على أي اتصال.",
    dropboxTitle: "تكامل Dropbox",
    dropboxConnectedTemplate: "متصل بالمجلد {folder}. تحفظ رموز الوصول مشفرة على الخادم.",
    dropboxDisabled: "غير مهيأ في بيئة الخادم. أضف إعدادات OAuth إلى الأسرار ثم أعد تحميل الحالة.",
    dropboxNotConnected: "غير متصل. يتطلب الربط بيانات OAuth معتمدة من مسؤول النظام.",
    dropboxStatusConnected: "متصل",
    dropboxStatusDisabled: "غير مهيأ",
    dropboxStatusNotConnected: "غير متصل",
    dropboxSecurityHelper: "لا تُدخل رموز Dropbox في المتصفح. يبدأ تدفق التفويض من بيئة الخادم بعد توفير بيانات الاعتماد.",
    storageTitle: "اختبار التخزين المحلي",
    storageDescription: "يفحص مجلد التخزين الافتراضي على الخادم بإنشاء ملف اختبار وقراءته ثم حذفه.",
    checking: "جاري الفحص...",
    retry: "إعادة المحاولة",
    storageTestButton: "فحص التخزين",
    storageSuccessTitle: "التخزين المحلي متصل",
    storageErrorTitle: "فشل فحص التخزين",
    storageError: "تعذر فحص التخزين المحلي.",
    storageConnectionError: "تعذر الاتصال بالخادم أثناء فحص التخزين.",
    databaseTitle: "اختبار قاعدة البيانات",
    databaseDescription: "أدخل بيانات هدف الاختبار. لا تُحفظ كلمة المرور في المتصفح أو في هذه الصفحة.",
    databaseFieldsAriaLabel: "بيانات اتصال قاعدة البيانات",
    driverLabel: "المشغّل",
    databasePathLabel: "مسار قاعدة البيانات",
    databaseNameLabel: "اسم قاعدة البيانات",
    databasePathPlaceholder: ":memory: أو /path/to/database.sqlite",
    hostLabel: "المضيف",
    portLabel: "المنفذ",
    usernameLabel: "اسم المستخدم",
    passwordLabel: "كلمة المرور",
    databaseTestButton: "فحص قاعدة البيانات",
    databaseSuccessTitle: "قاعدة البيانات متصلة",
    databaseErrorTitle: "فشل فحص قاعدة البيانات",
    databaseNameRequired: "أدخل اسم قاعدة البيانات أو مسار ملف SQLite قبل الفحص.",
    databasePortInvalid: "منفذ قاعدة البيانات يجب أن يكون رقماً بين 1 و65535.",
    databaseError: "تعذر فحص اتصال قاعدة البيانات.",
    databaseConnectionError: "تعذر الاتصال بالخادم أثناء فحص قاعدة البيانات."
  },
  related: {
    ariaLabel: "تنقل مركز الإعدادات",
    heading: "الأقسام ذات الصلة",
    description: "روابط سريعة إلى مراكز الإدارة والإعدادات الأخرى.",
    dataCenterTitle: "مركز البيانات",
    dataCenterDescription: "صحة النظام والنسخ الاحتياطية والاستعادة.",
    dataCenterLink: "الذهاب إلى المركز",
    templatesTitle: "قوالب الأقسام",
    templatesDescription: "قوالب مركزية بإصدارات وصلاحيات استعمال على مستوى القسم.",
    templatesLink: "إدارة القوالب",
    usersTitle: "المستخدمون والأدوار",
    usersDescription: "إدارة الوصول والأذونات.",
    usersLink: "إدارة المستخدمين",
    firstRunTitle: "الجولة الأولى",
    firstRunDescription: "قائمة فحص الإعدادات والتشغيل.",
    firstRunLink: "إعادة الفتح",
    statusTitle: "حالة النظام",
    statusDescription: "مراقبة اتصال الخادم والأداء.",
    statusLink: "عرض الحالة"
  },
  hub: {
    ariaLabel: "مركز الإعدادات الموحّد",
    heading: "مركز الإعدادات الموحّد",
    description: "أربعة أقسام تعكس ما هو مفعّل فعلاً على هذا النشر، وتشرح سبب أي قيمة مقفلة بدل إخفائها.",
    loading: "جارٍ تحميل ملفك الشخصي...",
    fallbackTitle: "تعذر تحميل الإعدادات من الخادم",
    fallbackDescription: "تُعرض القيم الافتراضية الآمنة مؤقتاً. أعد المحاولة للاتصال بالخادم.",
    retry: "إعادة المحاولة",
    writeConflictTitle: "تغيّرت هذه القيمة في مكان آخر",
    dismiss: "إغلاق",
    administration: {
      heading: "الإدارة",
      description: "ضوابط على مستوى النظام، متاحة للمدير فقط. القيمة الفعلية هنا تعكس ترتيب النشر ثم سياسة المدير ثم الافتراضي.",
      notEditableNote: "هذه القيمة ثابتة على هذا النشر ولا يمكن تعديلها من هنا.",
      statusLabels: {
        enabled: "مفعّلة",
        disabled: "معطّلة",
        needs_configuration: "يتطلب إعداداً إضافياً",
        unavailable: "غير متاحة في هذا النشر"
      },
      sourceLabels: {
        release: "افتراضي الإصدار",
        deployment: "إعداد النشر",
        system: "سياسة المدير",
        default: "القيمة الافتراضية",
        user: "تفضيل شخصي"
      },
      capabilities: {
        systemControl: { label: "التحكم بالنظام", description: "الوصول إلى أدوات تشغيل الخادم وإدارته من الواجهة." },
        backups: { label: "النسخ الاحتياطي", description: "تفعيل مهام النسخ الاحتياطي المجدولة والفورية." },
        trash: { label: "سلة المهملات", description: "الاحتفاظ بالعناصر المحذوفة مؤقتاً قبل الحذف النهائي." },
        odbc: { label: "جسر ODBC", description: "ربط الأنظمة القديمة عبر ODBC للقراءة والكتابة المقيدة." },
        broadcastMetadata: { label: "بيانات البث الوصفية", description: "استخراج وعرض البيانات الوصفية الخاصة بالبث." },
        semanticSearch: { label: "البحث الدلالي", description: "بحث قائم على المعنى بدلاً من مطابقة النص الحرفي فقط." },
        mediaProcessing: { label: "معالجة الوسائط الفعلية", description: "معالجة حقيقية للفيديو والصوت بدل المحاكاة." },
        ocr: { label: "التعرف الضوئي على النصوص", description: "استخراج نص من الصور والمستندات الممسوحة ضوئياً." },
        mcp: { label: "بروتوكول MCP", description: "اتصال أدوات خارجية بالأرشيف عبر بروتوكول سياق النموذج." }
      }
    },
    myExperience: {
      heading: "تجربتي",
      description: "تفضيلات شخصية قابلة للتعديل دائماً؛ تُحفظ لحسابك فقط ولا تؤثر في المستخدمين الآخرين. هذه القيم تجاوز إعداد التاريخ والوقت المركزي أدناه بالنسبة إليك وحدك.",
      save: "حفظ",
      saving: "جارٍ الحفظ...",
      saveSuccess: "تم الحفظ.",
      saveError: "تعذر الحفظ.",
      reset: "استعادة الإعداد الافتراضي",
      resetSuccess: "تمت الاستعادة إلى الإعداد الافتراضي.",
      resetError: "تعذر الاستعادة إلى الإعداد الافتراضي.",
      fields: {
        locale: { label: "لغة الواجهة (تجربتي)", options: { ar: "العربية", en: "الإنجليزية" } },
        timeZone: { label: "المنطقة الزمنية الشخصية", hint: "اسم منطقة زمنية بصيغة IANA، مثل Europe/Istanbul." },
        dateFormat: {
          label: "تنسيق التاريخ الشخصي",
          options: { dayFirst: "يوم/شهر/سنة", monthFirst: "شهر/يوم/سنة", yearFirst: "سنة-شهر-يوم" }
        },
        timeFormat: { label: "تنسيق الوقت الشخصي", options: { h24: "24 ساعة", h12: "12 ساعة" } },
        theme: {
          label: "النسق المرئي",
          options: {
            cinematicDark: "سينمائي داكن",
            luxuryDark: "فاخر داكن",
            oceanDark: "محيطي داكن",
            neutralLight: "فاتح محايد",
            highContrast: "تباين عالٍ"
          }
        },
        density: { label: "كثافة العرض", options: { comfortable: "مريحة", compact: "مدمجة" } },
        textScale: { label: "حجم النص", options: { small: "صغير", medium: "متوسط", large: "كبير" } },
        reducedMotion: { label: "تقليل الحركة والانتقالات" },
        homePage: { label: "الصفحة الرئيسية عند الدخول", hint: "مسار داخلي يبدأ بـ /، مثل /discover." },
        navigation: {
          label: "ترتيب عناصر التنقل",
          hiddenModulesTemplate: "الوحدات المخفية: {count}",
          customOrderYes: "ترتيب مخصص مطبّق",
          customOrderNo: "الترتيب الافتراضي"
        }
      }
    },
    media: {
      heading: "الوسائط",
      description: "تنسيق استوديو المراجعة، اختصارات التشغيل، وطريقة عرض قوائم الأرشيف. حالة معالجة الوسائط أدناه للاطلاع فقط.",
      capabilitiesHeading: "حالة معالجة الوسائط على هذا النشر",
      studioLayout: {
        heading: "تنسيق استوديو المراجعة",
        comments: { label: "موضع التعليقات", options: { left: "يسار", right: "يمين", hidden: "مخفي" } },
        transcript: { label: "موضع النص المفرّغ", options: { left: "يسار", right: "يمين", hidden: "مخفي" } },
        timelineHeight: { label: "ارتفاع الخط الزمني (بكسل)", hint: "من 160 إلى 720." },
        panels: {
          label: "اللوحات الظاهرة",
          options: { comments: "التعليقات", transcript: "النص المفرّغ", timeline: "الخط الزمني", metadata: "البيانات الوصفية" }
        }
      },
      shortcuts: {
        heading: "اختصارات التشغيل",
        playPause: "تشغيل/إيقاف مؤقت",
        seekForward: "تقديم",
        seekBackward: "ترجيع",
        nextComment: "التعليق التالي",
        previousComment: "التعليق السابق"
      },
      views: {
        heading: "طريقة عرض الأرشيف",
        mode: { label: "نمط العرض", options: { table: "جدول", grid: "شبكة" } },
        pageSize: { label: "عدد العناصر في الصفحة", hint: "من 1 إلى 200." },
        columnsSummaryTemplate: "أعمدة مخصصة: {count}",
        savedSearchSummary: "بحث محفوظ افتراضي: {value}",
        savedSearchNone: "بلا"
      }
    },
    notifications: {
      heading: "الإشعارات",
      description: "اختر الملخص اليومي والأحداث التي تريد إشعاراً بها.",
      dailyDigestLabel: "الملخص اليومي بالبريد الإلكتروني",
      optionalHeading: "إشعارات إضافية",
      events: {
        reviewAssigned: "تم تكليفك بمراجعة",
        commentMentioned: "إشارة إليك في تعليق",
        taskAssigned: "تم تكليفك بمهمة",
        rightsExpiring: "اقتراب انتهاء حقوق",
        mediaJobCompleted: "اكتملت مهمة وسائط"
      }
    }
  }
} as const;
