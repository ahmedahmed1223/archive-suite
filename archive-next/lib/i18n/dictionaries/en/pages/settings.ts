export const settings = {
  legacyTools: {
    ariaLabel: "Advanced operational tools",
    heading: "Advanced operational tools",
    description: "Security diagnostics, ODBC, Whisper processing, and connection tests, still outside the unified settings hub above."
  },
  toolbar: {
    eyebrow: "Settings center",
    title: "{brand} settings",
    description: "A single hub for identity, security, storage, ODBC, API, and appearance, distinguishing what is actually enforced from what still needs edit permissions or extra backend support.",
    metaIdentity: "System identity",
    metaSecurity: "Security",
    metaMonitoring: "Monitoring",
    usersAndRoles: "Users & roles",
    reopenTour: "Reopen tour",
    systemStatus: "System status",
    errorLog: "Error log"
  },
  setupBanner: {
    ariaLabel: "Setup journey",
    stepTitle: "Current step: review operating settings",
    description: "Run the storage and database tests below, then check system status to decide the next action.",
    continueReadiness: "Continue readiness check",
    viewTour: "View setup journey"
  },
  metrics: {
    ariaLabel: "Settings summary",
    identityLabel: "Identity",
    securityLabel: "Security",
    checking: "Checking",
    needsReview: "Needs review",
    loaded: "Loaded",
    securityDescriptionRate: "{rate} req/min",
    securityDescriptionReadOnly: "Read-only settings",
    odbcDescriptionTablesVisible: "{count} visible tables",
    odbcDescriptionLegacy: "Legacy system bridge",
    notAvailable: "Not available",
    writeLabel: "Writes",
    writeRestricted: "Restricted",
    writeClosed: "Closed",
    writeDescriptionTable: "Selected table: {table}"
  },
  identity: {
    ariaLabel: "System identity",
    heading: "System identity",
    descriptionTemplate: "{descriptor} with a primary Arabic name and a supporting Latin name for technical use."
  },
  categories: {
    ariaLabel: "Settings categories",
    system: {
      title: "System",
      summary: "General environment settings and operational retention, gathered in read-only mode.",
      items: ["Timezone: Europe/Istanbul", "Retention: per policy"]
    },
    storage: {
      title: "Storage",
      summary: "Storage indicators show where data lives and its limits, without editing tools.",
      items: ["Primary store: object storage", "Backup: scheduled", "Quota: monitored"]
    },
    api: {
      title: "API",
      summary: "A summary of the integration layer, the contract, its constraints, and what the UI depends on.",
      items: ["Version: v1", "Auth: short-lived token + secure refresh", "Rate limit: enabled"]
    },
    appearance: {
      title: "Appearance",
      summary: "The current display identity and visual theme, documented here for quick reference.",
      items: ["Theme: light", "Density: compact"],
      identityItemTemplate: "Identity: {brand}"
    }
  },
  security: {
    ariaLabel: "Security posture",
    heading: "Security posture",
    description: "A read-only summary showing the current access policy and enforced controls.",
    needsReview: "Needs review",
    readOnly: "Read only",
    loading: "Loading security settings...",
    errorPrefix: "Error: {error}",
    postureAriaLabel: "Current security controls",
    accessTokenTtl: "Access token lifetime",
    accessTokenTtlValue: "{minutes} min",
    rateLimit: "Requests per minute limit",
    rateLimitValue: "{limit} req",
    legacyPasswordUpgrade: "Legacy password upgrade",
    enabled: "Enabled",
    disabled: "Disabled",
    webhookAllowlist: "Webhook allowlist",
    webhookAllowlistValue: "{count} URL(s)",
    webhookAllowlistEmpty: "Empty",
    whisperProcessorLabel: "Whisper processor",
    whisperGpu: "GPU (CUDA)",
    whisperCpu: "CPU",
    cspHeading: "CSP policy (deploy-time)",
    corsHeading: "CORS origins (deploy-time)",
    loadError: "Unable to load security settings.",
    loadConnectionError: "Unable to reach the server to fetch settings."
  },
  display: {
    ariaLabel: "Date and time settings",
    heading: "Date and time",
    description: "A central setting that controls how every user sees dates and times without changing stored dates.",
    loading: "Loading date and time settings...",
    fallback: "The setting could not be loaded. The default format is being used temporarily.",
    timeZoneLabel: "Time zone",
    timeZoneHint: "Enter an IANA time-zone name, such as Europe/Istanbul.",
    dateFormatLabel: "Date format",
    timeFormatLabel: "Time format",
    dateFormatDayFirst: "Day/month/year",
    dateFormatMonthFirst: "Month/day/year",
    dateFormatYearFirst: "Year-month-day",
    timeFormat24: "24-hour",
    timeFormat12: "12-hour",
    showSecondsLabel: "Show seconds",
    previewLabel: "Preview",
    readOnly: "You can view the applied format. Only an administrator can change this setting.",
    save: "Save date and time settings",
    saving: "Saving...",
    saveSuccess: "Date and time settings were saved for all users.",
    saveError: "Unable to save date and time settings.",
    saveConnectionError: "Unable to reach the server to save date and time settings."
  },
  whisper: {
    ariaLabel: "Whisper processing setup",
    heading: "Whisper processing",
    description: "Choose the processor used by new audio and video transcription jobs. The central processor is the default.",
    loading: "Loading Whisper setting...",
    processorLabel: "Processor",
    cpuOption: "CPU — default",
    cudaOption: "GPU via CUDA",
    gpuHelperBefore: "The GPU option requires a",
    gpuHelperAfter: "worker running with CUDA and the NVIDIA Container Toolkit. Saving this option does not confirm GPU availability automatically; the job will fail with a clear message if the worker isn't ready.",
    saveError: "Unable to save the Whisper setting.",
    saveSuccess: "Whisper setting saved. It will apply to new transcription jobs.",
    saveConnectionError: "Unable to reach the server to save the Whisper setting.",
    loadError: "Unable to load the Whisper setting."
  },
  tips: {
    ariaLabel: "Contextual tips",
    heading: "Contextual tips",
    description: "The \"?\" help button shown in every page's toolbar, along with quick suggestions specific to it.",
    toggleLabel: "Show contextual tips on all pages",
    helper: "Re-enabling brings back every tip previously dismissed for this session or permanently."
  },
  odbc: {
      deleteConfirmTitle: "Delete row",
      deleteConfirmMessage: "The row with {key} will be permanently deleted from {table}. Continue?",
      updateConfirmTitle: "Update row",
      updateConfirmMessage: "The row with {key} in {table} will be overwritten with the entered values. Continue?",
    heading: "ODBC for legacy systems",
    description: "Connection check, a limited read-only preview, and restricted row writes for the allowed core tables only.",
    loading: "Checking ODBC...",
    errorPrefix: "Error: {error}",
    connectedTitle: "Connection ready",
    needsSetupTitle: "Needs setup",
    statusLabel: "Status",
    driverLabel: "ODBC driver",
    driverAvailable: "Available",
    driverUnavailable: "Unavailable",
    dsnLabel: "DSN",
    dsnNotConfigured: "Not configured",
    visibleTablesLabel: "Visible tables",
    tableLabels: {
      items: "Items",
      users: "Users",
      settings: "Settings",
      audit: "Audit"
    },
    statusMap: {
      connected: "Connected",
      disabled: "Disabled",
      missingDsn: "DSN missing",
      driverUnavailable: "Driver unavailable",
      failed: "Connection failed"
    },
    statusMessages: {
      disabled: "The ODBC bridge is disabled on the server environment.",
      missingDsn: "ODBC is enabled but the ODBC_DSN value is empty.",
      driverUnavailable: "The PHP ODBC extension or ODBC drivers are unavailable."
    },
    tableFieldLabel: "Core table",
    previewButtonLoading: "Reading",
    previewButton: "Preview",
    previewDisabledHelper: "Preview becomes available once ODBC is enabled, the DSN is set, and the driver is loaded on the server.",
    writeSectionTitle: "Restricted row write",
    writeSectionHelper: "Only accepts JSON object operations, and blocks secret, password, and token columns.",
    operationLabel: "Operation",
    operationInsert: "Insert row",
    operationUpdate: "Update row",
    operationDelete: "Delete row",
    keyColumnLabel: "Key column",
    keyValueLabel: "Key value",
    keyValuePlaceholder: "row id or key",
    valuesJsonLabel: "Values (JSON)",
    executeButtonSaving: "Running...",
    executeButton: "Run operation",
    invalidJson: "Enter the values as a valid JSON object.",
    writeSuccess: "{operation} executed on {affected} row(s).",
    writeError: "Unable to run the ODBC operation.",
    previewErrorPrefix: "Error: {error}",
    previewRowCount: "{count} row(s)",
    previewEmpty: "No rows within the current preview limit.",
    loadStatusError: "Unable to load ODBC status.",
    loadStatusConnectionError: "Unable to reach the server to fetch ODBC status.",
    loadPreviewError: "Unable to load the ODBC table preview.",
    loadPreviewConnectionError: "Unable to reach the server to preview the ODBC table."
  },
  connectionTest: {
    heading: "Connection tests",
    description: "Run a safe read/write check, then review the result before relying on any connection.",
    dropboxTitle: "Dropbox integration",
    dropboxConnectedTemplate: "Connected to folder {folder}. Access tokens are stored encrypted on the server.",
    dropboxDisabled: "Not configured on the server environment. Add OAuth settings to the secrets, then reload the status.",
    dropboxNotConnected: "Not connected. Linking requires OAuth credentials authorized by a system administrator.",
    dropboxStatusConnected: "Connected",
    dropboxStatusDisabled: "Not configured",
    dropboxStatusNotConnected: "Not connected",
    dropboxSecurityHelper: "Do not enter Dropbox tokens in the browser. The authorization flow starts from the server environment once credentials are provided.",
    storageTitle: "Local storage test",
    storageDescription: "Checks the default storage folder on the server by creating a test file, reading it, then deleting it.",
    checking: "Checking...",
    retry: "Retry",
    storageTestButton: "Test storage",
    storageSuccessTitle: "Local storage connected",
    storageErrorTitle: "Storage test failed",
    storageError: "Unable to test local storage.",
    storageConnectionError: "Unable to reach the server while testing storage.",
    databaseTitle: "Database test",
    databaseDescription: "Enter the test target details. The password is not stored in the browser or on this page.",
    databaseFieldsAriaLabel: "Database connection details",
    driverLabel: "Driver",
    databasePathLabel: "Database path",
    databaseNameLabel: "Database name",
    databasePathPlaceholder: ":memory: or /path/to/database.sqlite",
    hostLabel: "Host",
    portLabel: "Port",
    usernameLabel: "Username",
    passwordLabel: "Password",
    databaseTestButton: "Test database",
    databaseSuccessTitle: "Database connected",
    databaseErrorTitle: "Database test failed",
    databaseNameRequired: "Enter a database name or SQLite file path before testing.",
    databasePortInvalid: "The database port must be a number between 1 and 65535.",
    databaseError: "Unable to test the database connection.",
    databaseConnectionError: "Unable to reach the server while testing the database."
  },
  related: {
    ariaLabel: "Settings center navigation",
    heading: "Related sections",
    description: "Quick links to other admin and settings centers.",
    dataCenterTitle: "Data center",
    dataCenterDescription: "System health, backups, and restore.",
    dataCenterLink: "Go to center",
    templatesTitle: "Section templates",
    templatesDescription: "Central templates with versions and section-level usage permissions.",
    templatesLink: "Manage templates",
    usersTitle: "Users & roles",
    usersDescription: "Manage access and permissions.",
    usersLink: "Manage users",
    firstRunTitle: "First run",
    firstRunDescription: "Setup and operation checklist.",
    firstRunLink: "Reopen",
    statusTitle: "System status",
    statusDescription: "Monitor server connectivity and performance.",
    statusLink: "View status"
  },
  hub: {
    ariaLabel: "Unified settings hub",
    heading: "Unified settings hub",
    description: "Four sections that reflect what is actually enabled on this deployment, and explain why a locked value is locked instead of hiding it.",
    loading: "Loading your profile...",
    fallbackTitle: "Could not load settings from the server",
    fallbackDescription: "Safe default values are shown for now. Retry to reconnect to the server.",
    retry: "Retry",
    writeConflictTitle: "This value changed elsewhere",
    dismiss: "Dismiss",
    administration: {
      heading: "Administration",
      description: "System-level controls, available to administrators only. The effective value reflects deployment configuration first, then admin policy, then the release default.",
      notEditableNote: "This value is fixed on this deployment and cannot be changed here.",
      statusLabels: {
        enabled: "Enabled",
        disabled: "Disabled",
        needs_configuration: "Needs configuration",
        unavailable: "Unavailable on this deployment"
      },
      sourceLabels: {
        release: "Release default",
        deployment: "Deployment configuration",
        system: "Admin policy",
        default: "Default value",
        user: "Personal preference"
      },
      capabilities: {
        systemControl: { label: "System control", description: "Access to server operating tools and controls from the interface." },
        backups: { label: "Backups", description: "Enable scheduled and on-demand backup jobs." },
        trash: { label: "Trash", description: "Keep deleted items recoverable before permanent deletion." },
        odbc: { label: "ODBC bridge", description: "Legacy system integration over ODBC with restricted read/write." },
        broadcastMetadata: { label: "Broadcast metadata", description: "Extract and display broadcast-specific metadata." },
        semanticSearch: { label: "Semantic search", description: "Meaning-based search instead of literal text matching only." },
        mediaProcessing: { label: "Real media processing", description: "Genuine video and audio processing instead of simulation." },
        ocr: { label: "OCR", description: "Extract text from scanned images and documents." },
        mcp: { label: "MCP protocol", description: "Let external tools connect to the archive via the Model Context Protocol." }
      }
    },
    myExperience: {
      heading: "My experience",
      description: "Personal preferences that are always editable; saved to your account only and never affect other users. These values override the central date-and-time setting below for you alone.",
      save: "Save",
      saving: "Saving...",
      saveSuccess: "Saved.",
      saveError: "Could not save.",
      reset: "Restore default",
      resetSuccess: "Restored to the default.",
      resetError: "Could not restore the default.",
      fields: {
        locale: { label: "Interface language (my experience)", options: { ar: "Arabic", en: "English" } },
        timeZone: { label: "Personal time zone", hint: "An IANA time zone name, such as Europe/Istanbul." },
        dateFormat: {
          label: "Personal date format",
          options: { dayFirst: "Day/Month/Year", monthFirst: "Month/Day/Year", yearFirst: "Year-Month-Day" }
        },
        timeFormat: { label: "Personal time format", options: { h24: "24-hour", h12: "12-hour" } },
        theme: {
          label: "Visual theme",
          options: {
            cinematicDark: "Cinematic dark",
            luxuryDark: "Luxury dark",
            oceanDark: "Ocean dark",
            neutralLight: "Neutral light",
            highContrast: "High contrast"
          }
        },
        density: { label: "Display density", options: { comfortable: "Comfortable", compact: "Compact" } },
        textScale: { label: "Text size", options: { small: "Small", medium: "Medium", large: "Large" } },
        reducedMotion: { label: "Reduce motion and transitions" },
        homePage: { label: "Landing page on sign-in", hint: "An internal path starting with /, such as /discover." },
        navigation: {
          label: "Navigation order",
          hiddenModulesTemplate: "Hidden modules: {count}",
          customOrderYes: "Custom order applied",
          customOrderNo: "Default order"
        }
      }
    },
    media: {
      heading: "Media",
      description: "Review studio layout, playback shortcuts, and how archive lists are displayed. Media processing status below is for context only.",
      capabilitiesHeading: "Media processing status on this deployment",
      studioLayout: {
        heading: "Review studio layout",
        comments: { label: "Comments position", options: { left: "Left", right: "Right", hidden: "Hidden" } },
        transcript: { label: "Transcript position", options: { left: "Left", right: "Right", hidden: "Hidden" } },
        timelineHeight: { label: "Timeline height (px)", hint: "From 160 to 720." },
        panels: {
          label: "Visible panels",
          options: { comments: "Comments", transcript: "Transcript", timeline: "Timeline", metadata: "Metadata" }
        }
      },
      shortcuts: {
        heading: "Playback shortcuts",
        playPause: "Play/pause",
        seekForward: "Seek forward",
        seekBackward: "Seek backward",
        nextComment: "Next comment",
        previousComment: "Previous comment"
      },
      views: {
        heading: "Archive view",
        mode: { label: "View mode", options: { table: "Table", grid: "Grid" } },
        pageSize: { label: "Items per page", hint: "From 1 to 200." },
        columnsSummaryTemplate: "Custom columns: {count}",
        savedSearchSummary: "Default saved search: {value}",
        savedSearchNone: "None"
      }
    },
    notifications: {
      heading: "Notifications",
      description: "Choose the daily digest and the events you want to be notified about.",
      dailyDigestLabel: "Daily email digest",
      optionalHeading: "Additional notifications",
      events: {
        reviewAssigned: "Assigned a review",
        commentMentioned: "Mentioned in a comment",
        taskAssigned: "Assigned a task",
        rightsExpiring: "Rights approaching expiry",
        mediaJobCompleted: "Media job completed",
        taskDueSoon: "Task approaching its target deadline"
      }
    },
    presets: {
      heading: "Ready-made profiles",
      description: "Applying a profile copies its values into your own experience right away — editing the profile later never changes what you already applied, and it can never hide a mandatory security alert or a module this deployment has disabled.",
      apply: "Apply",
      applying: "Applying...",
      applySuccess: "Profile applied. You can still adjust any value by hand afterward.",
      applyError: "Could not apply the profile.",
      items: {
        archivist: { name: "Archivist", description: "Archive as the landing page, a detailed table view, and capture/organize prioritized in navigation." },
        reviewer: { name: "Reviewer", description: "Daily queue as the landing page, collaboration and review prioritized, heavy ingest tools hidden." },
        "media-editor": { name: "Media editor", description: "Media jobs as the landing page, a visual grid view, and system-administration tools hidden from navigation." },
        simple: { name: "Simple view", description: "The fewest navigation items and archive columns, for fast, uncluttered use." }
      }
    },
    navigationCustomization: {
      heading: "Navigation customization",
      description: "Reorder navigation groups and hide what you don't need. Settings and safety can never be hidden, and modules this deployment has disabled never show no matter what you choose.",
      orderHeading: "Group order",
      moveUp: "Move up",
      moveDown: "Move down",
      visibilityHeading: "Show navigation items",
      lockedMandatory: "Mandatory item, cannot be hidden",
      lockedByCapability: "Disabled on this deployment",
      saveError: "Could not save the navigation setting."
    },
    viewCustomization: {
      heading: "Archive columns and default search",
      description: "Choose which columns show in the archive table view, and a saved search to use as the default.",
      columnsHeading: "Columns",
      columns: { title: "Title", store: "Store", type: "Type", updated: "Last updated" },
      titleColumnLockedNote: "The title column always stays visible.",
      filtersHeading: "Default saved search",
      filtersNone: "None",
      filtersHint: "Applied whenever you open the archive fresh.",
      saveError: "Could not save the view setting."
    }
  }
} as const;
