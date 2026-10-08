# Custom Features & Modifications - GenflowAi

Dokumentasi fitur custom, perbaikan (fixes), dan penyesuaian (adjustments) yang ditambahkan pada project ini (di luar upstream 9Router original).

---

## 🚀 Custom Features

### 1. Allowed Model per API Key

**Status:** 🗑️ Removed (v0.5.99 migration) — digantikan oleh **upstream Per-Key Access Control**

Fitur ini sudah dihapus penuh dari codebase custom dan digantikan sistem resmi upstream yang setara (`d8c585fb`, ada sejak upstream v0.5.99): kolom `accessRestricted`/`accessAllow` di tabel `apiKeys`, UI **KeyAccessControls** di halaman Endpoint, dan gate `enforceKeyAccess` di seluruh handler `/v1/*` (chat, embeddings, STT, TTS, image, search, video, systemone).

#### Perbedaan Perilaku yang Perlu Diketahui

| Aspek | Custom lama (dihapus) | Upstream (aktif) |
|-------|----------------------|------------------|
| Pattern | Wildcard `*`, `provider/*`, `__none__` | Exact list combo/model saja |
| Key unrestricted | `allowedModels: []` | `restricted: false` |
| Response ditolak | 404 "Model not found" | 403 "not allowed to use model" |
| Model baru dari provider | Otomatis tercakup oleh `provider/*` | Harus ditambahkan manual ke allow list |

#### Migrasi Data Key `Fandy`

Pattern lama `["ag/*","kr/*","inf/*"]` dikonversi menjadi exact allow list di `access.allow` (restricted = true). Isi konkritnya diambil dari `/v1/models` pada saat migrasi. Key lain yang `allowedModels`-nya kosong tidak perlu tindakan apa pun — keduanya unrestricted secara default.

Kolom `allowedModels` tetap ada di database (tidak dihapus) sebagai arsip historis dan tidak lagi dibaca oleh kode.

#### File yang Dikembalikan ke Upstream

- `src/sse/handlers/chat.js`, `src/sse/services/model.js`
- `src/app/api/v1/models/route.js`, `src/app/api/v1/models/[...model]/route.js`, `src/app/api/v1beta/models/route.js`
- `src/app/api/keys/route.js`, `src/app/api/keys/[id]/route.js`
- `src/lib/db/repos/apiKeysRepo.js`, `src/lib/db/schema.js`
- `src/shared/components/ModelSelectModal.js`, `src/shared/components/index.js`

#### File yang Dihapus

- `src/lib/modelMatcher.js`, `src/shared/components/DualColumnModelPicker.js`, `src/shared/components/ApiKeyModelAccessModal.js`
- `src/shared/hooks/useModelGrouping.js`, `src/lib/db/migrations/002-add-allowed-models.js`
- `src/app/api/models/available/route.js`
- `tests/unit/allowed-models-backend.test.js`, `tests/unit/chat-allowed-models-capacity.test.js`

Catatan: filter `allowedModelsFilter` di seluruh ToolCard dashboard (Claude, Codex, Hermes, Cowork, dll.) juga dihapus — seleksi model di dashboard kini sepenuhnya mengikuti perilaku upstream.
### 2. Test All Models (Sequential Provider Model Testing)

**Status:** ✅ Implemented

Tombol "Test All" pada halaman Provider Detail untuk mengetes semua model secara otomatis dan bergantian.

| Fitur | Deskripsi |
|-------|-----------|
| **Sequential Testing** | Model dites satu per satu secara berurutan |
| **2-Second Delay** | Jeda 2 detik setelah setiap test selesai |
| **Visual Progress** | Icon spin, queue border, dan counter model |
| **Abort Button** | Tombol berubah menjadi "Stop" saat testing |
| **Result Indicators** | ✅ OK, ❌ Error, ⏳ Queue |

#### File yang Dimodifikasi

`src/app/(dashboard)/dashboard/providers/[id]/CompatibleModelsSection.js`

---

### 3. Quota Auto-Ping untuk Antigravity

**Status:** ✅ Implemented

Auto-ping Antigravity menggunakan alternating model Gemini dan Claude, sliding-window detection, scheduler state tracking, payload minimal, serta kontrol dashboard.

#### File yang Dimodifikasi

- `src/shared/constants/config.js`
- `src/shared/services/quotaAutoPing.js`
- `src/shared/services/initializeApp.js`
- `src/app/api/settings/route.js`
- `src/app/(dashboard)/dashboard/providers/[id]/page.js`
- `src/app/(dashboard)/dashboard/usage/components/ProviderLimits/index.js`
- `tests/unit/quota-auto-ping.test.js`

---

## 🛠️ Custom Fixes & Adjustments

### 1. Toggle Disable/Enable untuk noAuth Providers

**Status:** ✅ Implemented

Provider noAuth seperti Mimo Code Free dan OpenCode Free dapat di-enable/disable, disimpan menggunakan dummy connection, difilter di UI/model picker/API, serta diblokir di runtime. Semua pengecekan SQLite `0` dan `false` ditangani sebagai nonaktif.

#### File yang Dimodifikasi

Implementasi tersebar pada provider page, provider API, `/v1/models`, auth service, model picker, dashboard tools, Basic Chat, MITM, media providers, Usage, translator, dan initialization service.

---

### 2. cURL Test Section di Endpoint Page

**Status:** ✅ Implemented

Endpoint page menyediakan generator dan runner cURL untuk `/v1/models` serta `/v1/chat/completions`, API key selector, model picker, copy command, dan response preview.

#### File yang Dimodifikasi

`src/app/(dashboard)/dashboard/endpoint/EndpointPageClient.js`

---

### 3. Dynamic Model Fetch Suppression untuk Compatible Providers

**Status:** ✅ Implemented

Jika compatible provider sudah mempunyai `customModels` di 9Router, endpoint `/v1/models` tidak lagi melakukan auto-fetch ke upstream `/models` yang dapat mengembalikan model provider yang tidak dipilih user.

#### File yang Dimodifikasi

`src/app/api/v1/models/route.js`

---

### 4. Disabled Model Filtering dengan Provider ID Fallback (Kiro)

**Status:** ✅ Implemented

Filter disabled model memeriksa `outputAlias`, `staticAlias`, dan `providerId`, sehingga perbedaan alias Kiro (`kr`) dan ID provider (`kiro`) tidak lagi menyebabkan model disabled bocor ke `/v1/models`.

#### File yang Dimodifikasi

`src/app/api/v1/models/route.js`

---

## ⚠️ Known Upstream Interactions

### 1. `CopilotToolCard.js` — Dormant sejak upstream v0.5.69

**Status:** 🟡 Preserved but not rendered

Pada upstream v0.5.69 (commit `b84681d5`, _"feat(cli-tools): replace copilot mitm with vscode extension setup guide"_), `copilot` dipindahkan dari `MITM_TOOLS` ke `CLI_TOOLS` dengan `configType: "guide"` (memakai VS Code extension, bukan lagi MITM). Upstream juga menghapus branch `case "copilot"` dari `ToolDetailClient.js`.

Akibatnya:

| Aspek | Kondisi |
|-------|---------|
| **File** | `src/app/(dashboard)/dashboard/cli-tools/components/CopilotToolCard.js` tetap ada di disk |
| **Export** | Masih diekspor dari `components/index.js` (valid, tidak melanggar lint) |
| **Render** | ❌ Tidak dirender lagi — `copilot` sekarang jatuh ke `DefaultToolCard` (guide steps) |
| **Custom code** | Filter `allowedModels` (`isModelAllowed`) di dalamnya jadi dorman |
| **Dampak fungsional** | Tidak ada — halaman guide tidak punya model picker, jadi tidak ada yang perlu difilter |

**Keputusan:** File sengaja **tidak dihapus** agar customization mudah dipulihkan jika suatu saat flow MITM Copilot dikembalikan. Jangan anggap ini dead code yang perlu dibersihkan.

---

### 2. Antigravity quota grouping (upstream v0.5.69)

Upstream menggabungkan quota `gemini-*` dan `claude-*` menjadi 2 baris (`modelKey: "gemini"` / `"claude"`) di `ProviderLimits/utils.js`.

Fitur **Quota Auto-Ping** tidak terpengaruh: auto-ping membaca `getAntigravityUsage()` secara langsung di server dengan `quotaKey: "gemini-3-flash-agent"` (jalur data terpisah dari `parseQuotaData` milik UI), dan toggle-nya per-connection, bukan per-baris quota.

---

### 3. Pattern `allowedModels` yang menjadi stale

Upstream v0.5.69 menghapus beberapa model ID: `glm-5.0-turbo`, `minimax-m2.7`, `kimi-k2.5`, `hy3-preview`, `hy3-x`, `hy4-preview-x`, `deepseek-v3-2-volc` (codebuddy-cn), serta `qmodel_preview`, `gm51model` (qoder). Pada upstream v0.5.75, `deepseek-v4-flash` juga digantikan oleh `deepseek-v4.1-flash` (codebuddy-cn & opencode-go).

API Key yang menyimpan pattern ke model-model tersebut akan menampilkan label **"Model unavailable"** — ini perilaku by-design dari _Unavailable Pattern Marker_, bukan regresi. Pattern lama tetap tersimpan agar tidak ada data hilang.

---

### 4. Antigravity weekly quota tracking (upstream v0.5.75)

Upstream v0.5.75 menambahkan pelacakan kuota mingguan Antigravity (`gemini_weekly`, `claude_gpt_weekly`) di dashboard usage melalui `open-sse/services/usage/antigravity-weekly.js` dan `ProviderLimits/utils.js`.

Fitur **Quota Auto-Ping** tetap berjalan normal tanpa konflik: auto-ping beroperasi langsung pada query status sesi server menggunakan target key `gemini-3-flash-agent` (reset rolling 24 jam / sesi sliding), independen dari perhitungan ringkasan mingguan UI.

---

### 5. Live Catalog Cline & ClinePass di `ModelSelectModal.js` (upstream v0.5.75)

Upstream v0.5.75 menambahkan live model fetcher untuk provider `cline` dan `clinepass` via `useLiveProviderModels`.

Integrasi custom pada `src/shared/components/ModelSelectModal.js` diselaraskan agar hook `useLiveProviderModels` menerima argumen `shouldFetchModalData` (bukan hanya `isOpen`), sehingga sinkronisasi dan badge counter `All N Models` di visual model picker tetap menghitung model live Cline/ClinePass secara akurat.

---

### 6. Dynamic CLI Tools Config via `GenericCliToolCard.js` (upstream v0.5.85 - v0.5.91)

Upstream menambahkan `GenericCliToolCard.js` untuk konfigurasi dinamis CLI tools baru (Pi, OMP, Crush, ForgeCode, Smelt, CodeWhale).

Fitur **Allowed Model per API Key** diselaraskan ke dalam `GenericCliToolCard.js` dengan menyuntikkan `isModelAllowed`, reactive `useEffect` model filtering (Option A - Strict reset), serta passing prop `allowedModelsFilter` ke `ModelSelectModal`, sehingga model yang dipilih pada CLI tools baru otomatis dibatasi oleh API Key yang aktif.

---

### 7. Multi-Profile Codex CLI & Multi-Role Hermes Config (upstream v0.5.91)

Upstream v0.5.91 menambahkan dukungan multiple model profiles pada Codex CLI (`CodexToolCard.js`) serta slot multi-role pada Hermes Agent (`HermesToolCard.js`).

Custom model restriction (`allowedModelsFilter`) telah diselaraskan ke modal pemilihan profil Codex (`profileModalOpen`) dan modal role Hermes agar pemilihan model tetap terkontrol dan konsisten.

---

### 8. Dukungan Provider Baru (upstream v0.5.79 - v0.5.91)

Upstream v0.5.79 hingga v0.5.91 menambahkan beberapa provider baru: `qoder-cn` (Qoder CN), `tokenharbor` (Token Harbor), `opencode-zen` (OpenCode Zen PAYG), `xiaomi-mimo` (server-assisted desktop login), agregator OpenAI-compatible (`dahl`, `atria`, `agnes`, `bai`), dan lane `System One`.

Semua provider ini langsung terintegrasi secara mulus ke visual model picker `DualColumnModelPicker.js` dan query backend tanpa merusak aturan disabled/allowed models. Pengecekan active connection SQLite (`isActive !== false && isActive !== 0`) juga diperluas ke `qoder-cn`.

---

### 9. `requestedModel` di `handleSingleModelChat` (upstream v0.5.95)

Upstream v0.5.95 menambahkan parameter `requestedModel` (posisi ke-6) pada `handleSingleModelChat` di `src/sse/handlers/chat.js` untuk meneruskan context marker `[1m]` milik Claude Code ke `getProviderCredentials`.

Parameter custom `keyRecord` (Allowed Model per API Key) digeser ke posisi ke-7, dan seluruh 5 call site internal disesuaikan (`apiKey, null, keyRecord` untuk jalur combo/adapter/fusion). Kedua mekanisme berjalan berdampingan tanpa konflik.

---

### 10. Live Catalog Zed di `ModelSelectModal.js` (upstream v0.5.95)

Upstream v0.5.95 menambahkan live model fetcher untuk provider `zed` via `useLiveProviderModels`.

Sama seperti integrasi Cline/ClinePass (lihat poin 5), hook `zedModels` diselaraskan agar menerima argumen `shouldFetchModalData`, sehingga badge counter `All N Models` di visual model picker tetap menghitung model live Zed secara akurat.

---

### 11. Filter `hidden` Provider di Usage Stats (upstream v0.5.95)

Upstream v0.5.95 menambahkan filter `!p.hidden` pada daftar noAuth provider di `UsageStats.js` (exclude hidden providers dari usage stats).

Digabungkan dengan filter custom `!disabledNoAuth.has(p.id)` (fitur Toggle Disable/Enable noAuth) — kedua kondisi kini aktif bersamaan.

---

### 12. Fix Codex refresh-token reuse pada auto-ping (upstream v0.5.95)

Upstream v0.5.95 memperbaiki bug refresh-token reuse Codex (`0bc7f86e`) yang dapat mengeluarkan akun saat auto-ping.

Fitur **Quota Auto-Ping** diuntungkan oleh fix ini: ping Codex (`gpt-5.5` tiny request) kini tidak lagi berisiko meng-invalidate sesi akun. Tidak ada perubahan kode custom yang diperlukan.

---

### 13. Upstream Per-Key Access Control menggantikan Allowed Models custom (upstream v0.5.99)

Upstream v0.5.99 (`d8c585fb`) menambahkan **per-API-key access control** via kolom `accessRestricted`/`accessAllow` (schema v2): key restricted hanya boleh memanggil combo/model yang terdaftar (exact match, resolved identity, deny-by-default).

Awalnya Kiti jalankan paralel (intersection, request harus lolos kedua gate). Sejak migrasi v0.5.99, **sistem custom dihapus penuh** dan upstream access control menjadi satu-satunya mekanisme per-key restriction (lihat poin 1):

| Titik gate | Implementasi upstream |
|-------|-------------|
| chat & semua handler `/v1/*` | `enforceKeyAccess` / `enforceKeyAccessResolved` / `enforceKeyAccessProvider` |
| Combo + adapter models | `filterAdapterModels` |
| `GET /v1/models`, `/v1/models/{kind}` | `filterModelsListForKey` |

`apiKeysRepo.js` menyimpan kedua kolom sekaligus (`allowedModels` tetap, plus `accessRestricted`/`accessAllow`); lazy migration `ALTER TABLE` dipertahankan. UI Endpoint page kini menampilkan `KeyAccessControls` upstream **dan** badge `All N Models` custom berdampingan. `POST/PUT /api/keys` menerima `allowedModels` maupun `access`.

Key unrestricted di kedua sistem berperilaku sama seperti sebelumnya (backward compatible penuh).

---

### 14. Interaksi lainnya (upstream v0.5.99)

* **Hermes per-profile config** (`a9c9f683`): tombol "Apply to All Profiles" upstream digabung dengan guard custom `hermesStatus.installed` dan reset `allowedModelsFilter` tetap aktif pada modal multi-role.
* **AWS Bedrock** (`a9d0ad26`): validasi API key provider kini menerima `apiKeyOptionalWith` (substitusi `profile`); digabung dengan pengecualian custom noAuth (`!isFreeProvider && !hasApiKeySubstitute`).
* **Ping internal model test** (`d8c585fb`): upstream memilih key unrestricted lebih dulu; kriteria custom "SQLite `0` = inactive" dipertahankan dalam filter yang sama.
* **UI mobile layout** (`eea08215`): layout tombol `flex flex-wrap` upstream dipadukan dengan warna kuning "not installed" dan guard `installed` milik card Claude/Hermes.

---

## Planned Features

_Belum ada fitur lain yang direncanakan._
