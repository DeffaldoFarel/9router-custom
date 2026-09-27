# Custom Features & Modifications - GenflowAi

Dokumentasi fitur custom, perbaikan (fixes), dan penyesuaian (adjustments) yang ditambahkan pada project ini (di luar upstream 9Router original).

---

## 🚀 Custom Features

### 1. Allowed Model per API Key

**Status:** ✅ Implemented

Setiap API Key dapat dikonfigurasi untuk membatasi model mana saja yang bisa diakses.

#### Fitur Detail

| Fitur | Deskripsi |
|-------|-----------|
| **Pattern Matching** | Support wildcard: `*` (semua), `provider/*` (semua model dari provider), `provider/model` (model spesifik) |
| **Visual Model Picker** | Modal dual-column dengan group per provider: kolom kiri **Allowed**, kolom kanan **Restricted**. Klik model untuk memindahkannya antar kolom. |
| **Quick Provider Actions** | Tombol `Move all` pada setiap group provider untuk memindahkan seluruh model sekaligus. |
| **Search** | Pencarian model berlaku pada kedua kolom. |
| **Hybrid Save Format** | Jika seluruh model provider diizinkan, disimpan sebagai `provider/*`; jika sebagian, disimpan sebagai daftar model eksplisit. |
| **Explicit Deny-All** | Jika semua model dipindahkan ke Restricted, disimpan sebagai sentinel internal `["__none__"]`; array kosong `[]` tetap berarti unrestricted demi backward compatibility. |
| **Allowed Count Badge** | Menampilkan jumlah model yang diizinkan di setiap API Key, misalnya `All 100 Models` (jika unrestricted atau semua model diizinkan, misal 21 dari 21) atau `12 of 100 Models`. |
| **Unavailable Pattern Marker** | Pattern lama tetap disimpan, tetapi diberi label seperti `Provider disabled`, `Provider unavailable`, atau `Model unavailable`. |
| **404 Response** | Jika model tidak diizinkan, return 404 "Model not found" (bukan 403 "Not allowed") |
| **Models Endpoint Filter** | `GET /v1/models` hanya return model yang diizinkan untuk API Key tersebut |
| **Combo Filtering** | Combo models juga difilter berdasarkan allowed models |

#### Contoh Penggunaan

```bash
POST /api/keys
{
  "name": "Client A - Only GLM",
  "allowedModels": ["glm/*", "minimax/*"]
}

GET /v1/models
Authorization: Bearer sk-xxxxx
# → Hanya model yang cocok dengan allowedModels yang muncul
```

#### Pattern Support

| Pattern | Contoh | Deskripsi |
|---------|--------|-----------|
| `*` | `*` | Semua model |
| `provider/*` | `anthropic/*` | Semua model dari provider |
| `provider/model` | `glm/glm-4.7` | Model spesifik |
| `__none__` | `["__none__"]` | Tidak ada model yang diizinkan |
| `[]` (kosong) | `[]` | Unrestricted (default/backward-compatible) |

#### File yang Dimodifikasi

| File | Perubahan |
|------|-----------|
| `src/lib/db/migrations/002-add-allowed-models.js` | Migration baru |
| `src/lib/db/schema.js` | Kolom `allowedModels` di tabel `apiKeys` |
| `src/lib/db/repos/apiKeysRepo.js` | CRUD `allowedModels`, lazy migration fallback |
| `src/lib/modelMatcher.js` | Pattern matching utility dan explicit deny-all sentinel |
| `src/sse/services/model.js` | Backend model restriction matching helper |
| `src/sse/handlers/chat.js` | Model access check (return 404) |
| `src/app/api/v1/models/route.js` | Filter models by API key |
| `src/app/api/v1/models/[kind]/route.js` | Filter models by API key |
| `src/app/api/v1beta/models/route.js` | Filter Gemini models by API key |
| `src/app/api/keys/route.js` | Accept `allowedModels` di POST |
| `src/app/api/keys/[id]/route.js` | Accept `allowedModels` di PUT |
| `src/shared/components/ApiKeyModelAccessModal.js` | Modal wrapper dual-column |
| `src/shared/components/DualColumnModelPicker.js` | Dual-column picker dan hybrid pattern serializer |
| `src/shared/hooks/useModelGrouping.js` | Reusable model grouping/fetching hook |
| `src/shared/components/ModelSelectModal.js` | Model grouping dan filtering kompatibilitas |

---

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

## Planned Features

_Belum ada fitur lain yang direncanakan._
