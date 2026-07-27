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

### 3. Remote CLI Manual Config Availability

**Status:** ✅ Implemented

Memungkinkan endpoint, API key, dan model CLI dipilih serta disalin manual walaupun CLI tidak terinstall pada host 9Router remote.

#### File yang Dimodifikasi

Semua ToolCard di `src/app/(dashboard)/dashboard/cli-tools/components/`, termasuk Claude, Codex, OpenCode, OpenClaw, Cowork, DeepSeek TUI, Droid, Hermes, Jcode, Cline, Kilo, dan Copilot.

---

### 4. Quota Auto-Ping untuk Antigravity

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

### 3. Dual-Auth Provider Stats Aggregation

**Status:** ✅ Implemented

Kartu provider dual-auth seperti CodeBuddy CN menghitung koneksi OAuth, API Key, dan `api_key` secara bersamaan agar tidak menampilkan `No connections` secara keliru.

#### File yang Dimodifikasi

`src/app/(dashboard)/dashboard/providers/page.js`

---

### 4. Dynamic Model Fetch Suppression untuk Compatible Providers

**Status:** ✅ Implemented

Jika compatible provider sudah mempunyai `customModels` di 9Router, endpoint `/v1/models` tidak lagi melakukan auto-fetch ke upstream `/models` yang dapat mengembalikan model provider yang tidak dipilih user.

#### File yang Dimodifikasi

`src/app/api/v1/models/route.js`

---

### 5. Disabled Model Filtering dengan Provider ID Fallback (Kiro)

**Status:** ✅ Implemented

Filter disabled model memeriksa `outputAlias`, `staticAlias`, dan `providerId`, sehingga perbedaan alias Kiro (`kr`) dan ID provider (`kiro`) tidak lagi menyebabkan model disabled bocor ke `/v1/models`.

#### File yang Dimodifikasi

`src/app/api/v1/models/route.js`

---

## Planned Features

_Belum ada fitur lain yang direncanakan._
