# Custom Features - GenflowAi

Fitur-fitur custom yang ditambahkan pada project ini (tidak ada di upstream GenflowAi original).

---

## 1. Allowed Model per API Key

**Status:** ✅ Implemented

Setiap API Key dapat dikonfigurasi untuk membatasi model mana saja yang bisa diakses.

### Fitur Detail

| Fitur | Deskripsi |
|-------|-----------|
| **Pattern Matching** | Support wildcard: `*` (semua), `provider/*` (semua model dari provider), `provider/model` (model spesifik) |
| **Visual Model Picker** | Modal dengan UI visual untuk pilih model, mirip dengan "Add Model to Combo" |
| **Quick Add Provider** | Tombol per-provider aktif untuk quick add wildcard (e.g., `anthropic/*`), termasuk custom provider/prefix dan mengecualikan provider yang disabled. |
| **Clear All** | Tombol untuk mengosongkan seluruh allowed patterns sekaligus dari modal. |
| **Allowed Count Badge** | Menampilkan jumlah model yang diizinkan di setiap API Key, misalnya `All 100 Models` atau `12 of 100 Models`, dihitung dari logic `ModelSelectModal` agar sinkron dengan modal "Pick Model to Allow". |
| **Unavailable Pattern Marker** | Pattern lama tetap disimpan, tetapi diberi label jelas seperti `Provider disabled`, `Provider unavailable`, atau `Model unavailable` jika provider/model sudah tidak aktif/terhapus. |
| **404 Response** | Jika model tidak diizinkan, return 404 "Model not found" (bukan 403 "Not allowed") |
| **Models Endpoint Filter** | `GET /v1/models` hanya return model yang diizinkan untuk API Key tersebut |
| **Combo Filtering** | Combo models juga difilter berdasarkan allowed models |

### Contoh Penggunaan

```bash
# Create API Key dengan batasan model
POST /api/keys
{
  "name": "Client A - Only GLM",
  "allowedModels": ["glm/*", "minimax/*"]
}

# Response 404 jika model tidak diizinkan
POST /v1/chat/completions
Authorization: Bearer sk-xxxxx
{ "model": "anthropic/claude-sonnet-4-6", "messages": [...] }
# → 404 { "error": { "message": "Model not found: anthropic/claude-sonnet-4-6" } }

# GET /v1/models hanya return model yang diizinkan
GET /v1/models
Authorization: Bearer sk-xxxxx
# → Hanya glm/* dan minimax/* models yang muncul
```

### File yang Dimodifikasi

| File | Perubahan |
|------|-----------|
| `src/lib/db/migrations/002-add-allowed-models.js` | Migration baru |
| `src/lib/db/schema.js` | Kolom `allowedModels` di tabel `apiKeys` |
| `src/lib/db/repos/apiKeysRepo.js` | CRUD `allowedModels`, lazy migration fallback |
| `src/lib/modelMatcher.js` | Pattern matching utility |
| `src/sse/services/model.js` | Backend model restriction matching helper `isModelAllowedBackend` |
| `src/sse/handlers/chat.js` | Model access check (return 404) |
| `src/app/api/v1/models/route.js` | Filter models by API key |
| `src/app/api/v1/models/[kind]/route.js` | Filter models by API key |
| `src/app/api/v1beta/models/route.js` | Filter Gemini models by API key |
| `src/app/api/keys/route.js` | Accept `allowedModels` di POST |
| `src/app/api/keys/[id]/route.js` | Accept `allowedModels` di PUT |
| `src/shared/components/ApiKeyModelAccessModal.js` | UI modal visual picker |
| `src/shared/components/ModelSelectModal.js` | Fix custom provider models |
| `src/app/(dashboard)/dashboard/endpoint/EndpointPageClient.js` | Dashboard UI integration |

### Pattern Support

| Pattern | Contoh | Deskripsi |
|---------|--------|-----------|
| `*` | `*` | Semua model |
| `provider/*` | `anthropic/*` | Semua model dari provider |
| `provider/model` | `glm/glm-4.7` | Model spesifik |
| `[]` (kosong) | `[]` | Unrestricted (default, akses semua) |

---

## 2. Test All Models

**Status:** ✅ Implemented

Tombol "Test All" pada halaman Provider Detail untuk mengetes semua model secara otomatis dan bergantian.

### Fitur Detail

| Fitur | Deskripsi |
|-------|-----------|
| **Sequential Testing** | Model dites satu per satu secara berurutan |
| **2-Second Delay** | Jeda 2 detik setelah setiap test selesai sebelum lanjut ke model berikutnya |
| **Visual Progress** | Icon spin saat testing, border kuning untuk model dalam antrian |
| **Abort Button** | Tombol berubah jadi "Stop" saat testing, bisa dihentikan kapan saja |
| **Progress Counter** | Menampilkan jumlah model tersisa: "Testing... (5 left)" |
| **Result Indicators** | ✅ Hijau = OK, ❌ Merah = Error, ⏳ Kuning = Dalam Antrian |

### Lokasi Tombol

Tombol "Test All" berada di sebelah kanan tombol "Import from /models" pada halaman Provider Detail (Compatible Models section).

### File yang Dimodifikasi

| File | Perubahan |
|------|-----------|
| `src/app/(dashboard)/dashboard/providers/[id]/CompatibleModelsSection.js` | Tambah `handleTestAll`, state `testingAll`/`testQueue`, tombol "Test All" |

---

## 3. Remote CLI Manual Config Availability

**Status:** ✅ Implemented

Memungkinkan user untuk mengakses dan mengisi secara manual *endpoint*, *api key*, dan pilihan *model* untuk tools CLI di halaman dashboard meskipun tools tersebut tidak terinstall secara lokal di perangkat host 9Router (misalnya 9Router diletakkan di remote VPS sementara CLI berada di laptop/desktop).

### Fitur Detail

| Fitur | Deskripsi |
|-------|-----------|
| **Forced Config State Initialization** | State internal untuk model, endpoint dan api key di-populate biarpun CLI tool belum terinstal |
| **Unlocked Component UI** | Komponen dropdown selector (Endpoint, API Key, Model) tetap bisa diakses dan dipilih walau tool terdeteksi tidak terinstall |
| **Locked Executables** | Tombol *Apply* (yang mengeksekusi tulis config ke local disk) dan *Reset* tetap disembunyikan/didisable |
| **Precise Manual Copy** | Modal *Manual Config* kini dapat men-generate konfigurasi spesifik dari pilihan user untuk bisa di-copy & paste ke CLI Tool di remote device |

### File yang Dimodifikasi

Semua komponen `ToolCard` yang berada di `src/app/(dashboard)/dashboard/cli-tools/components/`:
- `ClaudeToolCard.js`
- `CodexToolCard.js`
- `OpenCodeToolCard.js`
- `OpenClawToolCard.js`
- `CoworkToolCard.js`
- `DeepSeekTuiToolCard.js`
- `DroidToolCard.js`
- `HermesToolCard.js`
- `JcodeToolCard.js`
- `ClineToolCard.js`
- `KiloToolCard.js`
- `CopilotToolCard.js`

---

## 4. Toggle Disable/Enable untuk noAuth Providers

**Status:** ✅ Implemented

Menambahkan fitur toggle (Enable/Disable) untuk _provider_ yang secara default tidak memerlukan autentikasi (`noAuth: true`), seperti Mimo Code Free dan OpenCode Free. Sebelumnya provider ini di-hardcode selalu aktif dan tombol toggle disembunyikan.

### Fitur Detail

| Fitur | Deskripsi |
|-------|-----------|
| **Dummy Connection Creation** | Membuat entri _connection_ semu di database saat user pertama kali melakukan toggle pada provider _noAuth_ yang belum pernah memiliki koneksi. |
| **Visible Toggle** | Menampilkan tombol Toggle (Enable/Disable) pada list Provider di halaman Dashboard > Providers. |
| **Status Badge Update** | Tampilan label status _Disabled_ berfungsi secara normal meskipun provider memiliki flag _noAuth_. |
| **SQLite Boolean Compatibility** | Memperbaiki filter `isActive` di seluruh aplikasi untuk memperhitungkan nilai `0` (integer) dari SQLite sebagai "non-aktif", selain nilai `false` (boolean). |
| **Model Filtering** | Provider yang di-disable tidak akan muncul di modal "Pick Model to Allow" dan endpoint `/v1/models`. |

### File yang Dimodifikasi

| File | Perubahan |
|------|-----------|
| `src/app/(dashboard)/dashboard/providers/page.js` | Modifikasi `allDisabled` checker dan mengubah fungsi `handleToggleProvider` untuk menangani pembuatan koneksi saat kosong. |
| `src/app/api/providers/route.js` | Menambahkan validasi untuk provider `noAuth` dan menyimpan `isActive` dari body request. |
| `src/app/(dashboard)/dashboard/endpoint/EndpointPageClient.js` | Filter `activeProviders` untuk memperhitungkan nilai `0` dari SQLite. |
| `src/app/api/v1/models/route.js` | Filter connections untuk memperhitungkan nilai `0` dari SQLite. |
| `src/app/(dashboard)/dashboard/cli-tools/[toolId]/ToolDetailClient.js` | Filter `getActiveProviders` untuk memperhitungkan nilai `0`. |
| `src/app/(dashboard)/dashboard/basic-chat/BasicChatPageClient.js` | Filter connections untuk memperhitungkan nilai `0`. |
| `src/app/(dashboard)/dashboard/mitm/MitmPageClient.js` | Filter `getActiveProviders` untuk memperhitungkan nilai `0`. |
| `src/app/(dashboard)/dashboard/providers/[id]/page.js` | Filter `activeConnection` untuk memperhitungkan nilai `0`. |
| `src/app/(dashboard)/dashboard/providers/[id]/CompatibleModelsSection.js` | Filter `activeConnection` dan `canImport` untuk memperhitungkan nilai `0`. |
| `src/app/(dashboard)/dashboard/providers/[id]/ConnectionRow.js` | Filter `isActive` untuk memperhitungkan nilai `0`. |
| `src/app/(dashboard)/dashboard/providers/components/ConnectionsCard.js` | Filter `isActive` untuk memperhitungkan nilai `0`. |
| `src/app/api/models/test/ping.js` | Filter `isActive` untuk memperhitungkan nilai `0`. |
| `src/app/api/translator/translate/route.js` | Filter `isActive` untuk memperhitungkan nilai `0`. |
| `src/app/api/translator/send/route.js` | Filter `isActive` untuk memperhitungkan nilai `0`. |
| `src/app/(dashboard)/dashboard/media-providers/[kind]/[id]/components/GenericExampleCard.js` | Filter `isActive` untuk memperhitungkan nilai `0`. |
| `src/app/(dashboard)/dashboard/media-providers/[kind]/[id]/components/TtsExampleCard.js` | Filter `isActive` untuk memperhitungkan nilai `0`. |
| `src/app/(dashboard)/dashboard/media-providers/[kind]/[id]/components/SttExampleCard.js` | Filter `isActive` untuk memperhitungkan nilai `0`. |
| `src/app/(dashboard)/dashboard/media-providers/[kind]/[id]/components/EmbeddingExampleCard.js` | Filter `isActive` untuk memperhitungkan nilai `0`. |
| `src/app/(dashboard)/dashboard/media-providers/combo/[id]/page.js` | Filter `isActive` untuk memperhitungkan nilai `0`. |
| `src/shared/services/initializeApp.js` | Filter `isActive` untuk memperhitungkan nilai `0`. |
| `src/shared/components/UsageStats.js` | Memfilter provider `noAuth` yang sudah di-disable agar tidak muncul di bagan/flow topology pada halaman Usage. |
| `src/sse/services/auth.js` | Mencegah injeksi virtual connection apabila provider `noAuth` secara eksplisit telah dinonaktifkan di database, sehingga benar-benar memblokir eksekusi API/chat. |
| `src/shared/components/ModelSelectModal.js` | Memastikan semua pemanggil modal model (termasuk Combos) memfilter koneksi `isActive: 0/false` dan mengecualikan provider `noAuth` yang sudah dinonaktifkan. |

---

## 5. cURL Test Section di Endpoint Page

**Status:** ✅ Implemented

Menambahkan section **cURL Test** di halaman `/dashboard/endpoint` tepat di bawah section API Keys untuk memudahkan validasi endpoint 9Router tanpa keluar dari dashboard.

### Fitur Detail

| Fitur | Deskripsi |
|-------|-----------|
| **Test `/v1/models`** | Generate command `curl` untuk endpoint model list dan bisa langsung menjalankan test dari dashboard. |
| **Test `/v1/chat/completions`** | Generate command `curl` untuk chat completions dengan pilihan API key, model, dan prompt. |
| **API Key Selector** | Dropdown API key aktif, otomatis memakai key aktif pertama jika tersedia. |
| **Model Picker Integration** | Menggunakan `ModelSelectModal`, sehingga menghormati provider yang disabled dan `allowedModels` pada API key. |
| **Copy Curl** | Tombol copy untuk command `curl` yang sudah lengkap. |
| **Run Test** | Tombol untuk menjalankan request langsung dan menampilkan response JSON/status di dashboard. |

### File yang Dimodifikasi

| File | Perubahan |
|------|-----------|
| `src/app/(dashboard)/dashboard/endpoint/EndpointPageClient.js` | Menambahkan state, helper curl generator, UI section cURL Test, runner `/models` dan `/chat/completions`, serta modal pemilih model. |

---

## 6. Quota Auto-Ping untuk Antigravity (Alternating Models)

**Status:** ✅ Implemented

Mengimplementasikan fitur Quota Auto-Ping pada provider Antigravity (mirip dengan fitur Codex Auto-Ping) untuk menghangatkan jendela kuota rolling secara otomatis. Khusus Antigravity, ping dikirimkan secara bergantian (*alternating*) antara model Gemini dan model Claude karena keduanya memiliki pool kuota terpisah.

### Fitur Detail

| Fitur | Deskripsi |
|-------|-----------|
| **Sliding Window Detection** | Mendeteksi pergeseran waktu reset (`resetAt` drift >= 30 detik) yang menandakan jendela kuota rolling sebelumnya telah kedaluwarsa. |
| **Alternating Models Ping** | Mengirimkan ping request secara bergantian antara model `gemini-3-flash` dan `claude-sonnet-4-6` untuk menghangatkan kedua pool kuota sekaligus. |
| **Scheduler State Tracking** | Menggunakan memori scheduler state (`state`) untuk melacak model terakhir yang di-ping agar giliran ping berikutnya presisi. |
| **Minimal Payload Size** | Request ping dikirimkan dengan konfigurasi minimal (`maxOutputTokens: 1` dengan prompt `"hi"`) untuk meminimalkan konsumsi kuota. |
| **Dashboard Controls & Tooltip** | Menambahkan switch toggle "Auto-ping" pada halaman detail provider Antigravity serta halaman Limits dashboard lengkap dengan tooltip deskriptif. |

### File yang Dimodifikasi

| File | Perubahan |
|------|-----------|
| `src/shared/constants/config.js` | Menambahkan konfigurasi `antigravity` di `QUOTA_AUTOPING_CONFIG.providers`. |
| `src/shared/services/quotaAutoPing.js` | Mengimpor `getAntigravityUsage`, mendefinisikan `sendAntigravityPing`, dan mengimplementasikan logika pergantian model ping berbasis state. |
| `src/app/api/settings/route.js` | Menambahkan pengecekan `"antigravityAutoPing"` di validasi PATCH settings. |
| `src/app/(dashboard)/dashboard/providers/[id]/page.js` | Menambahkan `antigravity` ke `AUTO_PING_SETTINGS_KEYS` untuk UI detail page. |
| `src/app/(dashboard)/dashboard/usage/components/ProviderLimits/index.js` | Menambahkan key, tooltip, dan reactive state untuk toggle auto-ping Antigravity di tabel Limits. |
| `tests/unit/quota-auto-ping.test.js` | Menambahkan unit tests khusus Antigravity auto-ping (memverifikasi absence, sliding reset, dan alternating model execution) serta memperbaiki mock dependency. |

---

## Planned Features

_Belum ada fitur lain yang direncanakan._
