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
| **Quick Add Provider** | Tombol per-provider untuk quick add wildcard (e.g., "anthropic/*") |
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
| `src/sse/handlers/chat.js` | Model access check (return 404) |
| `src/app/api/v1/models/route.js` | Filter models by API key |
| `src/app/api/v1/models/[kind]/route.js` | Filter models by API key |
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

## Planned Features

_Belum ada fitur lain yang direncanakan._
