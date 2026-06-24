# Myser — Project Handoff Document

## What Is This
Myser is a personal expense tracking Android app built with Next.js + Capacitor. It features OCR receipt scanning, budget management, cloud sync, and a learning category system. The app is functional and has been shared as a private beta APK.

## Tech Stack
- **Frontend:** Next.js 16.2.9, React 19, TypeScript
- **Database:** sql.js (SQLite in browser/WebView), persisted to localStorage as base64
- **Auth:** Firebase Authentication (Google sign-in + email/password)
- **Cloud sync:** Firestore (transactions, budgets, categories sync per-user)
- **OCR:** Google ML Kit Text Recognition (native Android, ~1-3 seconds per receipt)
- **Receipt storage:** IndexedDB (via `src/lib/doc-store.ts`) for file data, SQLite for metadata
- **Backup:** Google Drive API (direct REST calls with OAuth token) + ZIP export via JSZip
- **Mobile:** Capacitor 8.x wrapping the static Next.js export as an Android APK
- **Charts:** Recharts
- **Icons:** lucide-react
- **Styling:** Inline styles + globals.css (CSS variables for theming)

## Project Structure
```
src/
├── app/                    # Next.js pages
│   ├── page.tsx           # Redirects to /dashboard
│   ├── add/page.tsx       # Log expense (keypad, categories)
│   ├── dashboard/page.tsx # Main dashboard (budget/tracker modes)
│   ├── budget/page.tsx    # Budget allocation
│   ├── history/page.tsx   # Transaction history with filters
│   ├── analytics/page.tsx # Charts and spending analysis
│   ├── vault/page.tsx     # My Logs — receipt storage, backup/restore
│   ├── settings/page.tsx  # User settings (~1100 lines, has sub-panels)
│   └── layout.tsx         # Root layout with provider stack
├── components/
│   ├── AuthGate.tsx       # Login/onboarding/app gate
│   ├── AppDrawer.tsx      # Side menu (profile, my logs, budget, settings)
│   ├── BottomNav.tsx      # Mode-aware bottom navigation
│   ├── PageHeader.tsx     # Header with back button, notification bell, profile pic
│   ├── MyserLoader.tsx    # Animated M logo splash screen
│   ├── MonthPicker.tsx    # Custom month selector dropdown
│   ├── NotificationsPanel.tsx  # Pending OCR reviews
│   ├── ShareReceiptModal.tsx   # Handles shared images from other apps
│   ├── ShareHandler.tsx        # Listens for share intents on app resume
│   ├── TransactionList.tsx     # Grouped transaction display
│   ├── TransactionDetailModal.tsx  # Transaction detail with linked receipt
│   ├── DocumentViewer.tsx      # Fullscreen image/PDF viewer
│   ├── auth/LoginPage.tsx      # Google + email sign-in
│   ├── auth/RegisterPage.tsx   # Email registration
│   └── onboarding/OnboardingFlow.tsx  # Welcome → mode → currency
├── context/
│   ├── AuthContext.tsx         # Firebase auth state, sign out with data clear
│   ├── SyncContext.tsx         # Cloud sync state, auto-pull on login
│   ├── AppModeContext.tsx      # Budget vs tracker mode
│   ├── CurrencyContext.tsx     # Currency formatting
│   ├── DrawerContext.tsx       # Side drawer open/close
│   └── NotificationContext.tsx # Pending log count + processing state
└── lib/
    ├── db.ts                   # SQLite database — all CRUD operations (~600 lines)
    ├── firebase.ts             # Firebase app, auth, Firestore, storage init
    ├── firestore-sync.ts       # Upload/pull data + global merchant pool
    ├── ocr-pipeline.ts         # ML Kit OCR → extract amount/date/merchant/category
    ├── doc-store.ts            # IndexedDB wrapper for receipt file storage
    ├── drive-backup.ts         # Google Drive backup/restore with manifest
    ├── receipt-export.ts       # ZIP export/import with transaction re-linking
    ├── share-receiver.ts       # Capacitor plugin bridge for share intents
    ├── clear-user-data.ts      # Wipes all local data on sign-out
    └── currency.ts             # Currency configs and formatting

android/
├── app/src/main/java/com/owais/myser/
│   ├── MainActivity.java          # Registers plugins, handles share intents
│   ├── TextRecognizerPlugin.java  # ML Kit OCR Capacitor plugin
│   ├── ShareReceiverPlugin.java   # Reads shared images from SharedPreferences
│   └── FileSaverPlugin.java       # Saves files to Downloads via MediaStore
├── app/build.gradle               # ML Kit dependency, release signing config
├── build.gradle                   # Kotlin 2.1.20, coroutines 1.9.0 forced
├── variables.gradle               # SDK versions, Kotlin/coroutines versions
└── app/google-services.json       # Firebase config (NOT in git)
```

## Database Schema (SQLite)
```sql
categories (id, name, color, icon, sort_order)
transactions (id, category_id, amount, date, note, created_at, document_id, comment)
budgets (id, category_id, month, amount)
monthly_budget (id, month, total_amount)
documents (id, type, file_name, date, note, storage_path, local_path, mime_type, created_at)
pending_logs (id, document_id, merchant, amount, category_id, date, raw_ocr_text, status, created_at)
merchant_memory (id, merchant_key, merchant_display, category_id, times_seen, last_seen)
```

## Firestore Structure
```
users/{uid}/categories/{id}
users/{uid}/transactions/{id}
users/{uid}/budgets/{id}
users/{uid}/monthly_budget/{id}
users/{uid}/documents/{id}       # metadata only, no file data
global_merchant_data/{key}       # crowd-sourced merchant→category votes
```

## localStorage Keys
| Key | Purpose | Cleared on sign-out |
|-----|---------|-------------------|
| `financeapp_db` | Base64-encoded SQLite database | Yes |
| `myser_sync_enabled` | Cloud sync toggle | Yes |
| `myser_last_uid` | Last logged-in user UID (for sync detection) | Yes |
| `myser_onboarding_complete_{uid}` | Per-user onboarding flag | No |
| `myser_drive_token` | Cached Google Drive access token | Yes |
| `myser_drive_token_expiry` | Token expiry timestamp | Yes |
| `myser_last_drive_backup` | Last Drive backup timestamp | Yes |
| `financeapp_mode` | budget or tracker | Yes |
| `financeapp_currency` | Currency code (PKR, USD, etc.) | Yes |
| `myser_doc_{id}` | Legacy receipt data (migrating to IndexedDB) | Yes |

## IndexedDB
- Database: `myser_documents`, Store: `docs`
- Stores receipt file data (base64 strings) keyed by document ID
- Managed by `src/lib/doc-store.ts`

## Key Architectural Decisions

### Data Isolation
- Sign-out clears ALL localStorage + IndexedDB + resets in-memory SQLite
- On sign-in, checks Firestore for returning user data and pulls if exists
- Tracks `myser_last_uid` to detect different users on same device

### OCR Pipeline
1. Image → ML Kit Text Recognition (native Java plugin, 1-3 seconds)
2. Raw text → `extractAmount()` (line-by-line, priority: Total → Amount Due → currency-prefixed)
3. Raw text → `extractMerchant()` (known brands → high-confidence lines → first meaningful line)
4. Raw text → `extractDate()` (multiple date formats)
5. Merchant → `lookupMerchantCategory()` (local memory → global pool → keyword dictionary)
6. Creates pending_log → user reviews in notifications panel → confirms → saves as transaction
7. On confirm: saves merchant→category to local memory AND contributes to Firestore global pool

### Receipt Storage
- File data stored in IndexedDB (no size limit, unlike localStorage's 5MB)
- Falls back to localStorage for legacy data
- NOT synced to cloud (would need Firebase Storage Blaze plan)
- Backup via Google Drive API or ZIP export with manifest for re-linking

### Kotlin Version
- **Must be 2.1.20+** — Capacitor v8 plugins use `kotlin.coroutines.jvm.internal.SpillingKt` which only exists in Kotlin 2.1.0+
- Forced in `android/build.gradle` via `resolutionStrategy`
- This was a multi-hour debugging session — do NOT downgrade

## Secret Files (not in git)
These must be present locally to build:
1. `android/app/google-services.json` — Firebase Android config
2. `android/myser-release.keystore` — APK signing key
3. `android/keystore.properties` — keystore passwords
4. `.env.local` — Firebase web config (NEXT_PUBLIC_FIREBASE_* vars)

## Firebase Project
- Project: `masyr-9dbb9` (yes, the project kept the old name)
- Console: https://console.firebase.google.com
- Auth: Google + Email/Password enabled
- Firestore: Security rules lock user data by UID, global_merchant_data is shared
- Google Drive API: Enabled in Google Cloud Console
- Two Android OAuth clients registered (debug SHA-1 + release SHA-1)

## Build & Deploy Commands
```bash
# Development
npm run dev                    # localhost:3002

# Build static export
npm run build                  # outputs to /out

# Sync to Android
npx cap sync

# Debug APK
cd android && ./gradlew assembleDebug
# Output: android/app/build/outputs/apk/debug/app-debug.apk

# Release APK (signed)
cd android && ./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk

# Install to connected phone
adb install -r <path-to-apk>

# Launch
adb shell am start -n com.owais.myser/.MainActivity

# Capture crash logs
adb logcat -c && adb logcat | grep -iE "FATAL|AndroidRuntime|Capacitor/Console"
```

## Environment Setup
```
JAVA_HOME = C:/Program Files/Android/Android Studio/jbr
ANDROID_SDK_ROOT = %LOCALAPPDATA%/Android/Sdk
Node.js, npm, Android Studio must be installed
```

## Known Issues / Tech Debt
1. **Receipt images don't sync across devices** — only metadata syncs via Firestore. Images are in IndexedDB (local). Workaround: Drive backup + ZIP export/import.
2. **Settings page is ~1100 lines** — should be split into components
3. **No password reset flow** — email/password users can't recover accounts
4. **No CSV/PDF export** for accounting
5. **No recurring expenses** (rent, subscriptions)
6. **48MB APK size** — ML Kit text recognition model is ~30MB. Could use thin model that downloads on first use.
7. **Design inconsistencies** — some screens polished (dashboard, add), others less so (analytics, history)
8. **No automated tests**
9. **`output: 'export'` in next.config** — required for Capacitor but means no server-side features

## What's Working Well
- Google sign-in (native account picker on Android)
- ML Kit OCR (fast, accurate)
- Cloud sync (Firestore with auto-pull on login)
- Receipt scanning → pending review → confirm flow
- Learning merchant→category memory
- ZIP export/import with receipt re-linking
- Google Drive backup/restore
- Share target (receive images from gallery/WhatsApp/etc.)
- Budget allocation with transfer between categories
- Animated Myser logo loader

## GitHub
- Repo: https://github.com/owais-PCC/Myser
- Branch: master
- Private repo
