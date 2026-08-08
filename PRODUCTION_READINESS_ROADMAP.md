# Myser — Production Readiness, Audit & Feature Roadmap

This document serves as the master blueprint for the production overhaul, UX redesign, architectural hardening, and feature expansion of **Myser** prior to public release across iOS, Android, and Web.

---

## 📌 Master Feature & Audit Matrix

| Category | Problem / Limitation | Target Production Solution | Priority |
| :--- | :--- | :--- | :--- |
| **Signing In** | Fragile auth state, silent failures, missing Apple Sign-In | Robust state machine in `AuthContext`, inline error feedback, Apple Sign-In | 🔴 High |
| **Welcome Screen** | Design looks generic / "too AI" | Custom human-crafted UI, brand typography, spring micro-animations | 🔴 High |
| **Firebase Architecture** | Janky sync, missing offline queue, race conditions | Offline queueing in `firestore-sync.ts`, backoff retries, Firestore rules lock | 🔴 High |
| **Google Drive Backup** | Token expiration crashes, unvalidated zip restores | Auto-token refresh via Google Identity Services, zip schema validation | 🟡 Medium |
| **Cloud Receipt Sync** | Receipts sit ONLY in local IndexedDB (lost on new device/web) | Migrate file storage to **Firebase Storage** (`users/{uid}/receipts/{docId}`) | 🔴 High |
| **Uploading UI** | Scanning screen looks generic / "too AI" | Modern progress overlay with live OCR status ("Extracting Items...", "Categorizing...") | 🟡 Medium |
| **Report Viewer** | Auto-downloads PDF without preview; no completion notification | In-app **PDF Viewer Modal** + explicit download toast notification with "Open File" | 🟡 Medium |
| **Income Tracking** | Myser is 100% expense-only | SQLite `type` column (`'expense' \| 'income'`), Income categories, Net Cash Flow dashboard | 🔴 High |
| **Itemized OCR** | Entire receipt total assigned to 1 category (e.g. Groceries) | Line-by-line item extraction, multi-category splitting (Groceries + Clothes + Health) | 🔴 High |
| **Paid Features** | No monetization structure | Tiered feature gating (`'free' \| 'pro'`) for Cloud Storage, Itemized OCR, and CSV exports | 🟡 Medium |

---

## 1. Authentication & Sign-in Reliability

### Current Shortcomings
* `AuthContext` relies on synchronous `localStorage` reading to avoid hydration mismatches, but can cause desynchronization with Firebase Auth callbacks.
* No fallback UI when native Google sign-in fails or user closes the native Google account picker popup.
* Missing Apple Sign-In requirement for iOS App Store submission.

### Production Solution
1. **Auth State Machine**: Refactor `AuthContext` with formal states (`IDLE`, `AUTHENTICATING`, `AUTHENTICATED`, `ERROR`).
2. **Error Recovery**: Catch native Google Sign-In dismissals cleanly without triggering full-screen error alerts.
3. **Apple Sign-In**: Integrate `@capacitor-community/apple-sign-in` into `LoginPage.tsx` for iOS devices.
4. **Account Recovery**: Add a "Forgot Password?" reset link for email/password users.

---

## 2. Welcome & Onboarding Redesign (Removing "AI Look")

### Current Shortcomings
* The current welcome and onboarding screens (`OnboardingFlow.tsx`) use generic cards, stock gradients, and templated layouts that feel like standard AI-generated placeholder UI.

### Production Solution
1. **Brand Aesthetic**: Re-skin using Myser's core brand identity: Emerald `#047857`, Slate `#0f172a`, glassmorphism, and custom typography.
2. **Interactive Onboarding Carousel**:
   - **Slide 1**: *Take Control of Your Money* (Hero animated Myser logo mark).
   - **Slide 2**: *Smart OCR Receipt Scanning* (Interactive receipt preview snippet).
   - **Slide 3**: *Choose Your Operating Mode* (Budget Allocation vs Expense Tracker toggle).
   - **Slide 4**: *Select Main Currency* (Clean search grid with local currency detection).
3. **Micro-Animations**: Add spring animations (`framer-motion` or smooth CSS keyframes) for page transitions.

---

## 3. Production Firebase & Sync Hardening

### Current Shortcomings
* `firestore-sync.ts` executes raw Firestore writes without network connection state listeners.
* Concurrent edits on multiple devices can cause database state overwrites.

### Production Solution
1. **Offline Queueing**: If a user logs an expense while offline, queue the write in SQLite and flush to Firestore when connectivity is restored.
2. **Exponential Backoff**: Retry failed sync requests (up to 5 retries with exponential backoff).
3. **Firestore Security Rules**: Ensure strict security rules:
   ```js
   match /users/{userId}/{document=**} {
     allow read, write: if request.auth != null && request.auth.uid == userId;
   }
   ```

---

## 4. Google Drive Backup & Restore Hardening

### Current Shortcomings
* `drive-backup.ts` makes direct REST calls with a cached access token. When the token expires, backups fail silently.
* Database restore directly overwrites `financeapp_db` without validating manifest structure.

### Production Solution
1. **Token Lifecycle Manager**: Use Google Identity Services OAuth 2.0 PKCE flow to automatically refresh access tokens when expired.
2. **Restore Safeguards**:
   - Inspect `manifest.json` inside the `.zip` archive before unpacking.
   - Verify SQLite table headers match `categories`, `transactions`, `budgets`, `documents`.
   - Create a local rollback backup before applying a cloud restore.
3. **Progress Feedback**: Show progress bars during backup creation ("Zipping documents..." → "Uploading to Google Drive...").

---

## 5. Cloud Receipt Storage Architecture (Firebase Storage)

### Current Shortcomings
* Receipt images (`data_base64`) are stored strictly inside the local device's IndexedDB (`doc-store.ts`).
* **Critical Issue**: If a user switches phones or uses the upcoming desktop Web App, receipt images are missing!

### Production Solution

```
┌─────────────────────────────────────────────────────────────┐
│                 Cloud Receipt Architecture                  │
└─────────────────────────────────────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
   [ Local IndexedDB ]                 [ Firebase Storage ]
 (Fast offline image cache)         (users/{uid}/receipts/{id}.jpg)
            │                                     │
            └──────────────────┬──────────────────┘
                               │
                    [ Cross-Device Sync ]
         (Web App & iOS/Android stay 100% in sync)
```

1. **Upload Pipeline**: Upon scanning/uploading a receipt, write image data to IndexedDB locally **and** upload asynchronously to Firebase Storage.
2. **Lazy Cloud Pull**: When viewing a document on a new device/web browser, if the receipt image is not in IndexedDB, fetch it from Firebase Storage and cache it locally.

---

## 6. Uploading & Scanning UI Redesign (Removing "AI Look")

### Current Shortcomings
* Scanning receipts shows a simple generic spinner or static progress dialog.

### Production Solution
1. **Real-Time Stage Indicator**:
   - Stage 1: *"Capturing receipt image..."*
   - Stage 2: *"Running OCR text extraction..."*
   - Stage 3: *"Matching merchant & line items..."*
   - Stage 4: *"Done!"*
2. **Visual Skeleton Preview**: Display an animated receipt scanner frame with a scanning beam over the receipt photo while OCR is processing.

---

## 7. In-App PDF Report Viewer & Download Feedback

### Current Shortcomings
* Clicking "Generate Report" triggers a direct browser download.
* No in-app preview is available.
* On mobile devices, users are left confused about where the downloaded PDF went.

### Production Solution
1. **In-App Report Viewer Modal (`ReportViewerModal.tsx`)**:
   - When generating a report, open a full-screen preview modal displaying the PDF.
   - Controls: Zoom In/Out, Page 1/2 indicator, "Share PDF", and "Download to Device".
2. **Download Feedback Toasts**:
   - On Android/iOS: Show a toast: *"Report saved to Downloads/Myser/myser-report-2026-08.pdf"* with an **"Open File"** button.
   - On Web: Trigger download and display a confirmation banner with file size and timestamp.

---

## 8. Income Tracking System

### Current Shortcomings
* Myser is strictly expense-focused. Users cannot log income, salary, or freelance payments, making it impossible to see Net Savings or total financial balance.

### Production Solution

#### Database Schema Update (`db.ts`)
Add `type` column to `transactions` table:
```sql
ALTER TABLE transactions ADD COLUMN type TEXT NOT NULL DEFAULT 'expense'; -- 'expense' | 'income'
```

#### Default Income Categories
* 💼 **Salary** (`#10B981`, icon: 💰)
* 💻 **Freelance / Side Business** (`#3B82F6`, icon: 💻)
* 📈 **Investments** (`#8B5CF6`, icon: 📈)
* 🎁 **Gifts & Refunds** (`#EC4899`, icon: 🎁)
* 💵 **Other Income** (`#64748B`, icon: 💵)

#### UI Adjustments
1. **Add Page (`/add`)**: Add a segmented control at the top: `[ Expense | Income ]`.
2. **Dashboard (`/dashboard`)**:
   - Show **Net Cash Flow** card: `Total Income - Total Expenses = Net Savings`.
   - Add Income vs Expense dual bar chart.

---

## 9. Itemized Supermarket OCR & Multi-Category Splitting

### Current Shortcomings
* When scanning a receipt from a supermarket (e.g. Carrefour or Walmart), OCR puts the **entire bill total** into a single category (e.g. Groceries).
* A single receipt often contains items from multiple categories: Milk (Groceries), Panadol (Health), T-Shirt (Clothes), Battery (Utilities).

### Production Solution

```
┌─────────────────────────────────────────────────────────────┐
│                 Itemized Supermarket OCR                    │
└─────────────────────────────────────────────────────────────┘
  Receipt Raw Text:
  1. Carrefour Fresh Milk 2L ........ $4.50  -->  [Groceries]
  2. Panadol Extra 20s .............. $6.00  -->  [Health]
  3. Cotton Crew T-Shirt ........... $15.00  -->  [Clothes]
  ─────────────────────────────────────────────────────────────
  Result: 3 Split Transactions proposed in Pending Notifications
```

1. **Itemized OCR Extractor (`ocr-pipeline.ts`)**:
   - Scan line-by-line for `[Item Name] .......... [Price]`.
   - Run keyword categorization per line item against category dictionaries.
2. **Split Review Modal**:
   - In `NotificationsPanel.tsx`, present itemized receipts as a split group.
   - Users can tweak individual item categories or confirm the multi-category split with one tap.

---

## 10. Paid / Premium Features Strategy (Monetization)

To support cloud storage costs and advanced features, Myser will offer a **Free** vs **Myser Pro** tier:

| Feature | Free Tier | Myser Pro |
| :--- | :--- | :--- |
| **Expense & Income Logging** | Unlimited | Unlimited |
| **Local SQLite & IndexedDB** | Included | Included |
| **Standard OCR Scanning** | Single-category totals | Single-category totals |
| **Itemized Supermarket OCR** | ❌ No | ✅ **Unlimited Multi-Category Splitting** |
| **Cloud Receipt Sync (Firebase)** | ❌ Local device only | ✅ **Cloud Storage Sync across Mobile & Web** |
| **Google Drive Auto Backup** | Manual ZIP export | ✅ **Automated Daily Cloud Backups** |
| **Accounting Exports** | Basic PDF Report | ✅ **CSV, Excel & PDF Statements** |
| **AI Wealth Advisor** | Standard prompts | ✅ **Custom AI Financial Insights** |

---

## 🛠️ Execution Plan Summary

When development begins, implementation will proceed in **4 Structured Sprints**:

1. **Sprint 1 (Auth, Onboarding Redesign & Firebase Setup)**: Hardening sign-in, redesigning onboarding/uploading UI, and adding Apple Sign-In.
2. **Sprint 2 (Cloud Receipt Sync & PDF Viewer)**: Integrating Firebase Storage for receipts and creating the in-app PDF preview modal.
3. **Sprint 3 (Income Tracking)**: Database schema migration, income categories, Net Cash Flow widgets, and dual logging UI.
4. **Sprint 4 (Itemized OCR & Myser Pro Tiering)**: Itemized receipt scanner, multi-category split reviews, and Pro feature gating.
