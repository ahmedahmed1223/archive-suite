# Cloud Onboarding and FileStore Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** بناء إعداد Cloud تلقائي، مزامنة pgAdmin، مزودي SFTP/WebDAV، ومدير ملفات مستقل مع صندوق تجهيز للأرشفة.

**Architecture:** يقرأ الخادم مخطط onboarding من `.env` ويعيد نموذجًا منظمًا للمعالج. تبقى FileStore port متوافقة وتضاف فوقها خدمة قدرات اختيارية وAPI موحد للملفات، بينما تحفظ قائمة الانتظار كسجل domain جديد في StorageProvider. الواجهة تستخدم عميل API وview model نقيين، ثم تعرض القائمة والشبكة من حالة واحدة.

**Tech Stack:** React 19، Vite، Vitest، DaisyUI 5، Node 22، FileStore port، ssh2-sftp-client، webdav، Docker Compose، pgAdmin setup.py.

---

## خريطة الملفات

- `archive-server/config/onboarding.config.js`: مخطط القيم الافتراضية والجاهزية.
- `archive-server/src/api/presetConfig.js`: حل المخطط وإرجاع preset آمن ومنظم.
- `archive-app/src/features/onboarding/presetModel.js`: hydration واختيار preset حسب backend.
- `archive-app/src/features/onboarding/FileStoreSetupStep.jsx`: اختيار مزود الملفات وحالته.
- `archive-server/deploy/pgadmin-init.sh`: مزامنة مستخدم pgAdmin وملف اتصال Postgres.
- `archive-server/src/files/fileStoreOperations.js`: عمليات browse/folder/copy/move المشتركة.
- `archive-server/src/files/fileStoreProviders.js`: تعريف المزودات والحقول المطلوبة والجاهزية.
- `archive-server/src/adapters/files-sftp/index.js`: محول SFTP.
- `archive-server/src/adapters/files-webdav/index.js`: محول WebDAV.
- `archive-app/src/features/file-manager/fileManagerClient.js`: عميل API.
- `archive-app/src/features/file-manager/viewModel.js`: مسارات، تصفية، queue، وعرض list/grid.
- `archive-app/src/pages/FileManagerPage.jsx`: مساحة العمل.
- `archive-app/src/services/storage/schema.js`: store باسم `file_ingest_queue`.

## Task 1: نموذج إعداد المعالج الخادمي

**Files:**
- Create: `archive-server/config/onboarding.config.js`
- Modify: `archive-server/src/api/presetConfig.js`
- Create: `archive-server/src/api/__tests__/presetConfig.test.js`

- [ ] **Step 1: اكتب اختبارًا فاشلًا لحل PostgreSQL وبيانات المدير**

```js
it("returns same-origin Postgres defaults and the configured admin login", async () => {
  const result = await getPresetConfig({ env: {
    BACKEND: "postgres",
    ADMIN_USERNAME: "admin",
    ADMIN_PASSWORD: "Initial-123!",
    JWT_AUTH_SECRET: "secret",
    FILE_STORE: "disk",
    FILE_STORE_DIR: "/files"
  }, testDatabase: async () => true });
  expect(result).toMatchObject({
    backend: "postgres",
    serverUrl: "",
    sameOrigin: true,
    adminUsername: "admin",
    adminPassword: "Initial-123!",
    mustChangePassword: true,
    authConfigured: true
  });
});
```

- [ ] **Step 2: شغّل الاختبار وتحقق من RED**

Run: `pnpm --filter archive-server exec vitest run src/api/__tests__/presetConfig.test.js`

Expected: FAIL لأن `getPresetConfig` لا يقبل env ولا يعيد الحقول الجديدة.

- [ ] **Step 3: نفذ مخطط الإعداد والحل بالحقن**

```js
export const ONBOARDING_CONFIG = Object.freeze({
  backend: "BACKEND",
  serverUrl: "APP_BASE_URL",
  adminUsername: "ADMIN_USERNAME",
  adminPassword: "ADMIN_PASSWORD",
  authSecrets: ["JWT_AUTH_SECRET", "JWT_SECRET"],
  fileStore: "FILE_STORE"
});
```

اجعل `getPresetConfig({ env = process.env, testDatabase, testPocketBase })` يعيد database وfileStore حتى عند نقص الإعداد، ويستخدم `ADMIN_USERNAME` و`JWT_AUTH_SECRET` الصحيحين.

- [ ] **Step 4: شغّل الاختبار وتحقق من GREEN**

Run: `pnpm --filter archive-server exec vitest run src/api/__tests__/presetConfig.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add archive-server/config/onboarding.config.js archive-server/src/api/presetConfig.js archive-server/src/api/__tests__/presetConfig.test.js
git commit -m "feat(onboarding): expose resolved cloud setup defaults"
```

## Task 2: Hydration المعالج واختيار FileStore

**Files:**
- Create: `archive-app/src/features/onboarding/presetModel.js`
- Create: `archive-app/src/features/onboarding/presetModel.test.js`
- Create: `archive-app/src/features/onboarding/FileStoreSetupStep.jsx`
- Create: `archive-app/src/features/onboarding/FileStoreSetupStep.test.jsx`
- Modify: `archive-app/src/features/onboarding/V1OnboardingWizard.jsx`
- Modify: `archive-app/src/features/onboarding/flow.js`

- [ ] **Step 1: اكتب اختبارات hydration وتغيير backend**

```js
expect(createPresetFormState({ backend: "postgres", serverUrl: "", adminUsername: "admin", adminPassword: "pw", fileStore: { active: "s3" } })).toEqual({
  storageChoice: "postgres", storageUrl: "", cloudUsername: "admin", cloudPassword: "pw", fileStoreChoice: "s3"
});
expect(selectBackendPreset(preset, "pocketbase").storageUrl).toBe("http://pocketbase:8090");
```

- [ ] **Step 2: شغّل الاختبارات وتحقق من RED**

Run: `pnpm --filter @archive/app exec vitest run src/features/onboarding/presetModel.test.js src/features/onboarding/FileStoreSetupStep.test.jsx`

Expected: FAIL لأن helper والخطوة غير موجودين.

- [ ] **Step 3: نفذ النموذج والخطوة**

`FileStoreSetupStep` يستقبل `providers`, `value`, `onChange`, `onTest`, `testing`, ويعرض جميع المزودات: disk/s3/dropbox/azure/gdrive/ftp/smb/sftp/webdav مع status وmissingEnv.

- [ ] **Step 4: اربط المعالج**

عند نجاح preset fetch استدع `createPresetFormState` لتعبئة الحقول فورًا. أضف خطوة `file-store` بعد storage، واجعل finish يحفظ المزود بعد نجاح login عبر admin config. امسح cloudPassword بعد نجاح الإنهاء.

- [ ] **Step 5: شغّل الاختبارات والبناء**

Run: `pnpm --filter @archive/app exec vitest run src/features/onboarding/presetModel.test.js src/features/onboarding/FileStoreSetupStep.test.jsx src/bootstrap/cloudSession.login.test.js`

Run: `pnpm --filter @archive/app run build:cloud`

Expected: PASS وbuild exit 0.

- [ ] **Step 6: Commit**

```bash
git add archive-app/src/features/onboarding
git commit -m "feat(onboarding): hydrate cloud and file store defaults"
```

## Task 3: مزامنة pgAdmin على volume جديد وقديم

**Files:**
- Create: `archive-server/deploy/pgadmin-init.sh`
- Modify: `archive-server/docker-compose.postgres.yml`
- Modify: `archive-server/deploy/pgadmin-servers.json`
- Create: `archive-server/scripts/verify-pgadmin-init.mjs`

- [ ] **Step 1: اكتب verify فاشلًا لبنية Compose**

```js
assert.match(compose, /pgadmin-init:/);
assert.match(compose, /condition:\s*service_completed_successfully/);
assert.match(compose, /PGPASS_FILE/);
assert.doesNotMatch(compose, /dpage\/pgadmin4:latest/);
```

- [ ] **Step 2: شغّل verify وتحقق من RED**

Run: `pnpm --filter archive-server exec tsx scripts/verify-pgadmin-init.mjs`

Expected: FAIL لغياب init واستخدام latest.

- [ ] **Step 3: نفذ init idempotent**

استخدم نفس صورة pgAdmin المثبتة في init والخدمة. شغّل `setup.py setup-db` ثم `get-users`; نفذ `add-user` أو `update-user EMAIL --password PASSWORD --admin`. اكتب passfile:

```sh
printf '%s:%s:*:%s:%s\n' "${POSTGRES_HOST:-postgres}" "${POSTGRES_PORT:-5432}" "${POSTGRES_USER:-archive}" "$POSTGRES_PASSWORD" > /var/lib/pgadmin/pgpass
chmod 600 /var/lib/pgadmin/pgpass
```

- [ ] **Step 4: تحقق من Compose وvolume حي**

Run: `pnpm --filter archive-server exec tsx scripts/verify-pgadmin-init.mjs`

Run: `docker compose --env-file archive-server/.env -f archive-server/docker-compose.postgres.yml up -d pgadmin`

Expected: pgadmin-init exit 0 وpgadmin healthy/reachable على 5050.

- [ ] **Step 5: Commit**

```bash
git add archive-server/deploy archive-server/docker-compose.postgres.yml archive-server/scripts/verify-pgadmin-init.mjs
git commit -m "fix(pgadmin): reconcile persisted login and database password"
```

## Task 4: تعريف المزودات وخدمة عمليات FileStore

**Files:**
- Create: `archive-server/src/files/fileStoreProviders.js`
- Create: `archive-server/src/files/fileStoreOperations.js`
- Create: `archive-server/src/files/__tests__/fileStoreOperations.test.js`
- Modify: `archive-core/src/storage/ports/FileStore.js`

- [ ] **Step 1: اكتب اختبارات fallback للنسخ والنقل والمجلدات**

```js
await copyEntry(store, "a.txt", "folder/a.txt");
expect(await store.getBlob("folder/a.txt")).toEqual(Buffer.from("a"));
await moveEntry(store, "folder/a.txt", "done/a.txt");
expect(await store.getBlob("folder/a.txt")).toBeNull();
expect(await store.getBlob("done/a.txt")).toEqual(Buffer.from("a"));
```

- [ ] **Step 2: تحقق من RED**

Run: `pnpm --filter archive-server exec vitest run src/files/__tests__/fileStoreOperations.test.js`

- [ ] **Step 3: نفذ الخدمة والقدرات الاختيارية**

لا تجعل القدرات الجديدة مطلوبة في `isFileStore`. استخدم methods الأصلية إن وجدت، وإلا getBlob/putBlob/remove. لا تحذف المصدر قبل نجاح كتابة الوجهة.

- [ ] **Step 4: اختبر GREEN وcore**

Run: `pnpm --filter archive-server exec vitest run src/files/__tests__/fileStoreOperations.test.js`

Run: `pnpm --filter @archive/core run verify`

- [ ] **Step 5: Commit**

```bash
git add archive-core/src/storage/ports/FileStore.js archive-server/src/files
git commit -m "feat(files): add provider capabilities and safe file operations"
```

## Task 5: مزودا SFTP وWebDAV

**Files:**
- Create: `archive-server/src/adapters/files-sftp/index.js`
- Create: `archive-server/src/adapters/files-sftp/index.test.js`
- Create: `archive-server/src/adapters/files-webdav/index.js`
- Create: `archive-server/src/adapters/files-webdav/index.test.js`
- Modify: `archive-server/src/bootstrap/registerCloudProviders.js`
- Modify: `archive-server/src/config/serverConfig.js`
- Modify: `archive-server/package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: أضف dependency الرسمية**

Run: `pnpm --filter archive-server add ssh2-sftp-client webdav`

- [ ] **Step 2: اكتب اختبارات contract فاشلة بعملاء محقونين**

اختبر put/get/list/createFolder/copy/move/remove، ورفض `../secret`، وdescribe الذي لا يعرض password أو private key.

- [ ] **Step 3: تحقق من RED**

Run: `pnpm --filter archive-server exec vitest run src/adapters/files-sftp/index.test.js src/adapters/files-webdav/index.test.js`

- [ ] **Step 4: نفذ المحولين وسجلهما**

`buildFileStore` يقبل `sftp` و`webdav`. `VALID_FILE_STORES` يضم النوعين. حقن client factory يجعل الاختبارات بلا شبكة.

- [ ] **Step 5: تحقق من GREEN**

Run: `pnpm --filter archive-server exec vitest run src/adapters/files-sftp/index.test.js src/adapters/files-webdav/index.test.js src/config/__tests__/serverConfig.test.js`

- [ ] **Step 6: Commit**

```bash
git add archive-server/src/adapters archive-server/src/bootstrap/registerCloudProviders.js archive-server/src/config/serverConfig.js archive-server/package.json pnpm-lock.yaml
git commit -m "feat(files): add SFTP and WebDAV providers"
```

## Task 6: حفظ واختبار كل مزودي FileStore

**Files:**
- Modify: `archive-server/src/api/adminConfig.js`
- Modify: `archive-server/src/api/server.js`
- Modify: `archive-server/src/config/serverConfig.js`
- Modify: `archive-app/src/features/settings/fileStoreConfigClient.js`
- Modify: `archive-app/src/features/settings/FileStoreSettings.jsx`
- Modify: `archive-server/src/api/__tests__/adminConfig.test.js`

- [ ] **Step 1: اكتب اختبارات validation لكل kind**

```js
for (const kind of ["disk","dropbox","s3","azure","gdrive","ftp","smb","sftp","webdav"]) {
  expect(validateFileStoreConfig({ kind })).toMatchObject({ kind });
}
```

- [ ] **Step 2: تحقق من RED**

Run: `pnpm --filter archive-server exec vitest run src/api/__tests__/adminConfig.test.js`

- [ ] **Step 3: وسع config view والحفظ والاختبار**

أعد `configured`, `missingEnv`, `active`, `restartRequired`. أضف `POST /api/files/test-provider` admin-only، ويبني مزودًا مؤقتًا ويستخدم اختبار put/get/list/remove.

- [ ] **Step 4: حدّث إعدادات الواجهة**

اعرض select لكل المزودات، الحالة والحقول غير السرية، واحفظ kind. لا تعرض قيم الأسرار.

- [ ] **Step 5: تحقق**

Run: `pnpm --filter archive-server exec vitest run src/api/__tests__/adminConfig.test.js`

Run: `pnpm --filter @archive/app exec vitest run src/features/settings/fileStoreConfigClient.test.js`

- [ ] **Step 6: Commit**

```bash
git add archive-server/src/api archive-server/src/config archive-app/src/features/settings
git commit -m "feat(settings): manage every file store provider"
```

## Task 7: API تصفح وإدارة الملفات

**Files:**
- Modify: `archive-server/src/api/server.js`
- Create: `archive-server/src/api/__tests__/fileBrowserApi.test.js`

- [ ] **Step 1: اكتب API tests فاشلة**

اختبر auth وGET browser وPOST folders وPOST actions للنسخ والنقل وإعادة التسمية والحذف الجماعي، مع نتيجة جزئية لكل عنصر.

- [ ] **Step 2: تحقق من RED**

Run: `pnpm --filter archive-server exec vitest run src/api/__tests__/fileBrowserApi.test.js`

- [ ] **Step 3: نفذ المسارات**

استخدم `fileStoreOperations.js`. طبّق limit بحد أقصى 200، cursor مبني على آخر key، query داخل path، وأخطاء `{ code, message, provider, retryable }`.

- [ ] **Step 4: تحقق من GREEN وAPI regression**

Run: `pnpm --filter archive-server exec vitest run src/api/__tests__/fileBrowserApi.test.js`

Run: `pnpm --filter archive-server run verify:api`

- [ ] **Step 5: Commit**

```bash
git add archive-server/src/api/server.js archive-server/src/api/__tests__/fileBrowserApi.test.js
git commit -m "feat(files): expose authenticated file manager API"
```

## Task 8: نموذج صندوق التجهيز

**Files:**
- Modify: `archive-app/src/services/storage/schema.js`
- Modify: `archive-app/src/services/storage/index.js`
- Create: `archive-app/src/features/file-manager/ingestQueue.js`
- Create: `archive-app/src/features/file-manager/ingestQueue.test.js`
- Modify: `archive-server/src/adapters/cloud-pocketbase/mapping.js`
- Modify: `archive-server/pocketbase/pb_schema.json`

- [ ] **Step 1: اكتب اختبارات policy وحالات queue**

```js
expect(shouldQueueUpload({ globalDefault: true })).toBe(true);
expect(shouldQueueUpload({ globalDefault: true, uploadOverride: false })).toBe(false);
expect(moveQueuedFile(record, "new/file.mp4").fileKey).toBe("new/file.mp4");
```

- [ ] **Step 2: تحقق من RED**

Run: `pnpm --filter @archive/app exec vitest run src/features/file-manager/ingestQueue.test.js`

- [ ] **Step 3: نفذ store وhelpers**

أضف `FILE_INGEST_QUEUE: "file_ingest_queue"` وupgrade IndexedDB. أضف mapping snapshot اختياري وPocketBase collection generic. الحالة الافتراضية pending ولا ينشأ video item.

- [ ] **Step 4: تحقق من GREEN وstorage regression**

Run: `pnpm --filter @archive/app exec vitest run src/features/file-manager/ingestQueue.test.js`

Run: `pnpm --filter @archive/app run verify`

- [ ] **Step 5: Commit**

```bash
git add archive-app/src/services/storage archive-app/src/features/file-manager/ingestQueue* archive-server/src/adapters/cloud-pocketbase/mapping.js archive-server/pocketbase/pb_schema.json
git commit -m "feat(files): persist pending archive ingest queue"
```

## Task 9: عميل مدير الملفات وview model

**Files:**
- Create: `archive-app/src/features/file-manager/fileManagerClient.js`
- Create: `archive-app/src/features/file-manager/fileManagerClient.test.js`
- Create: `archive-app/src/features/file-manager/viewModel.js`
- Create: `archive-app/src/features/file-manager/viewModel.test.js`

- [ ] **Step 1: اكتب اختبارات العميل والمسارات**

اختبر Bearer، encoding للمسار، browser cursor، action payload، breadcrumbs، merge pagination، اختيار متعدد، وحفظ list/grid.

- [ ] **Step 2: تحقق من RED**

Run: `pnpm --filter @archive/app exec vitest run src/features/file-manager/fileManagerClient.test.js src/features/file-manager/viewModel.test.js`

- [ ] **Step 3: نفذ العميل والنموذج**

العميل لا يقرأ FileStore مباشرة؛ كل العمليات عبر `/api/files/*`. view model pure ولا يعتمد DOM.

- [ ] **Step 4: تحقق من GREEN**

Run: `pnpm --filter @archive/app exec vitest run src/features/file-manager/fileManagerClient.test.js src/features/file-manager/viewModel.test.js`

- [ ] **Step 5: Commit**

```bash
git add archive-app/src/features/file-manager
git commit -m "feat(files): add file manager client and view model"
```

## Task 10: صفحة مدير الملفات والتنقل

**Files:**
- Create: `archive-app/src/pages/FileManagerPage.jsx`
- Create: `archive-app/src/pages/FileManagerPage.test.jsx`
- Modify: `archive-app/src/app/pageManifest.js`
- Modify: `archive-app/src/app/pageRegistry.js`
- Modify: `archive-app/src/components/navigation/Sidebar.jsx`
- Modify: `archive-app/src/components/navigation/PageContextBar.jsx`

- [ ] **Step 1: اكتب UI tests فاشلة**

اختبر تحميل path، تبديل list/grid، مجلد جديد، تحديد متعدد، فتح upload، auto queue الافتراضي، والانتقال إلى نموذج الأرشفة فقط عند الضغط الصريح.

- [ ] **Step 2: تحقق من RED**

Run: `pnpm --filter @archive/app exec vitest run src/pages/FileManagerPage.test.jsx`

- [ ] **Step 3: نفذ الصفحة**

استخدم DaisyUI `button`, `input`, `table`, `modal`, `drawer`, `dropdown`, `toggle`, `loading`, `alert`, و`breadcrumbs`. القائمة هي الافتراضية؛ الشبكة تستخدم نفس items/selection. اجعل folder tree drawer على الهاتف والمفتش panel مستقلًا.

- [ ] **Step 4: اربط navigation**

أضف page id `file-manager` إلى production group مع `FolderKanban` أو `Files` من lucide. اجعل uploader يوجه إلى الصفحة الجديدة أو يبقى shortcut للرفع.

- [ ] **Step 5: اختبر UI والبناء**

Run: `pnpm --filter @archive/app exec vitest run src/pages/FileManagerPage.test.jsx`

Run: `pnpm --filter @archive/app run build:cloud`

- [ ] **Step 6: Commit**

```bash
git add archive-app/src/pages/FileManagerPage* archive-app/src/app archive-app/src/components/navigation
git commit -m "feat(files): add provider-neutral file manager workspace"
```

## Task 11: الربط مع الرفع والأرشفة

**Files:**
- Modify: `archive-app/src/components/upload/UploadQueueController.jsx`
- Modify: `archive-app/src/pages/FileManagerPage.jsx`
- Modify: `archive-app/src/features/archive/FileArchiveWizard.jsx`
- Create: `archive-app/src/features/file-manager/archiveHandoff.test.js`

- [ ] **Step 1: اكتب اختبارات handoff فاشلة**

اختبر أن الرفع الناجح يضيف pending عند auto=true، لا يضيف عند override=false، وأن archive action يمرر `fileKey/name/mimeType/size` ثم يوسم queue archived بعد حفظ item.

- [ ] **Step 2: تحقق من RED**

Run: `pnpm --filter @archive/app exec vitest run src/features/file-manager/archiveHandoff.test.js`

- [ ] **Step 3: نفذ handoff**

أضف callback `onStored(result, file)` إلى UploadQueueController. افتح FileArchiveWizard من الصفحة بقيم مسبقة. حدّث queue بعد نجاح `addVideoItem` فقط.

- [ ] **Step 4: تحقق من GREEN وupload regressions**

Run: `pnpm --filter @archive/app exec vitest run src/features/file-manager/archiveHandoff.test.js src/features/archive/FileArchiveWizard.upload.test.jsx src/pages/AddVideoPage.upload.test.jsx`

- [ ] **Step 5: Commit**

```bash
git add archive-app/src/components/upload/UploadQueueController.jsx archive-app/src/pages/FileManagerPage.jsx archive-app/src/features/archive archive-app/src/features/file-manager/archiveHandoff.test.js
git commit -m "feat(files): stage uploads for explicit archive handoff"
```

## Task 12: البيئة والتحقق الحي

**Files:**
- Modify: `archive-server/.env.example`
- Modify: `archive-server/scripts/verify-cloud-live.mjs`
- Modify: `archive-server/package.json`
- Modify: `README.md`

- [ ] **Step 1: أضف متغيرات SFTP/WebDAV وتوثيق pgAdmin**

وثق فرق `PGADMIN_PASSWORD` و`POSTGRES_PASSWORD`، ومتغيرات SFTP/WebDAV، وأن كلمة مرور المعالج الافتراضية مرئية للمتصفح ويجب تغييرها.

- [ ] **Step 2: وسع verify-cloud-live**

أضف checks لـpreset-config وfile browser وfolder/copy/move/delete وqueue، وتحقق pgAdmin login بالـvolume الحالي.

- [ ] **Step 3: شغّل التحقق الكامل**

Run: `pnpm --filter archive-server run verify`

Run: `pnpm --filter @archive/app run verify`

Run: `pnpm --filter @archive/app run build:cloud`

Run: `pnpm --filter archive-server run verify:cloud-live`

Expected: جميع الأوامر exit 0.

- [ ] **Step 4: تحقق مرئي**

افتح `http://localhost:8937/#/file-manager` واختبر desktop وmobile: page identity، DOM غير فارغ، console بلا أخطاء، list/grid، إنشاء مجلد، رفع ملف، queue، وحذف ملف الاختبار.

- [ ] **Step 5: Commit ودفع master**

```bash
git add archive-server/.env.example archive-server/scripts/verify-cloud-live.mjs archive-server/package.json README.md
git commit -m "docs(files): document cloud setup and storage manager"
git push origin master
```
