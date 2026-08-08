# Myser — iOS Porting & App Store Submission Guide

This document provides a comprehensive, step-by-step roadmap for making **Myser** fully compatible with iOS devices and submitting it to the Apple App Store.

---

## 1. Architectural Strategy: Single Repo vs. Separate Repos

### Recommended Approach: **Single Unified Codebase**

> **Do NOT split into separate repositories for Android and iOS.**

Capacitor is specifically designed to manage cross-platform apps from a **single Next.js / TypeScript codebase**. 

* **Why Single Repo?**
  - **95% Code Sharing:** Your pages, UI components, SQLite database operations (`sql.js`), Firebase sync, currency handling, and charts are identical across Web, Android, and iOS.
  - **Zero Maintenance Overhead:** Splitting repos would force you to double-write every feature, bug fix, or UI update.
  - **Native Folder Coexistence:** Capacitor places native platform folders side-by-side (`/android` and `/ios`) in the root directory.
  - **Clean Platform Checks:** Handle platform-specific behavior cleanly using runtime checks:
    ```typescript
    import { Capacitor } from '@capacitor/core';

    if (Capacitor.getPlatform() === 'ios') {
      // iOS-specific plugin or flow
    } else if (Capacitor.getPlatform() === 'android') {
      // Android-specific plugin or flow
    }
    ```

---

## 2. Audit & Gap Analysis: Android vs. iOS Requirements

| Area | Current Android Implementation | Required iOS Implementation | Priority |
| :--- | :--- | :--- | :--- |
| **Account Deletion** | Missing | **Mandatory** (App Store Guideline 5.1.1(ix)) | 🔴 Rejection Risk |
| **Authentication** | Google + Email/Password | **Sign in with Apple** required alongside Google (Guideline 4.8) | 🔴 Rejection Risk |
| **OCR Scanner** | Android Java ML Kit (`TextRecognizerPlugin.java`) | Apple Vision Framework (`VNRecognizeTextRequest`) or `@capacitor-community/text-recognition` | 🔴 Core Feature |
| **PDF Saving** | Android `Directory.ExternalStorage` (`Download/Myser/`) | `@capacitor/share` or `Directory.Documents` | 🟡 Functional Fix |
| **Safe Areas** | Fixed status bar / navbar | `viewport-fit=cover` & CSS `env(safe-area-inset-*)` for notch / dynamic island | 🟡 UI Polish |
| **Privacy Manifest** | Not present | `PrivacyInfo.xcprivacy` required for iOS 17+ | 🔴 Submission Block |
| **Native Project** | `/android` exists | `/ios` needs initialization via `@capacitor/ios` | 🔴 Setup |

---

## 3. Step-by-Step Porting & Implementation Roadmap

### Step 1: Implement In-App Account Deletion (App Store Guideline 5.1.1(ix))
Apple will reject any app that allows user registration without an in-app account deletion mechanism.

1. Add a **"Delete Account"** section in `src/app/settings/page.tsx`.
2. Upon user confirmation:
   - Call `deleteUser(auth.currentUser)` from Firebase Auth.
   - Delete user documents in Firestore (`users/{uid}`).
   - Call `clearUserData()` from `src/lib/clear-user-data.ts` to wipe local SQLite and localStorage.

---

### Step 2: Add "Sign in with Apple" (App Store Guideline 4.8)
Guideline 4.8 requires Sign in with Apple whenever a 3rd-party social login (Google) is present.

1. Install the plugin:
   ```bash
   npm install @capacitor-community/apple-sign-in
   ```
2. Enable **Apple** as a sign-in provider in Firebase Console (`masyr-9dbb9`).
3. Update `src/components/auth/LoginPage.tsx` to display a **"Continue with Apple"** button for iOS users.

---

### Step 3: Platform Abstraction for Native Features

#### A. OCR Scanner Pipeline (`src/lib/ocr-pipeline.ts`)
* **iOS Implementation**:
  Use `@capacitor-community/text-recognition` or a custom Swift plugin leveraging Apple's native **Vision Framework**:
  ```typescript
  import { Capacitor, registerPlugin } from '@capacitor/core';

  async function recognizeText(base64Data: string): Promise<string> {
    if (Capacitor.getPlatform() === 'ios') {
      const OCR = registerPlugin<{ recognize: (opts: { base64: string }) => Promise<{ text: string }> }>('TextRecognizer');
      const res = await OCR.recognize({ base64: base64Data });
      return res.text;
    }
    // Android native plugin fallback
    // Browser Tesseract fallback...
  }
  ```

#### B. PDF Report Generation & Downloads (`src/lib/report-generator.ts`)
* Replace Android `ExternalStorage` with cross-platform sharing:
  ```typescript
  import { Capacitor } from '@capacitor/core';
  import { Share } from '@capacitor/share';
  import { Filesystem, Directory } from '@capacitor/filesystem';

  if (Capacitor.getPlatform() === 'ios') {
    // Write PDF to Documents directory
    const fileResult = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Documents,
    });
    // Open iOS Share Sheet so user can "Save to Files" or AirDrop
    await Share.share({
      title: 'Myser Financial Report',
      url: fileResult.uri,
    });
  }
  ```

---

### Step 4: iOS Safe Area & UI Adaptation

1. **Viewport Meta Tag** (`src/app/layout.tsx`):
   ```html
   <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
   ```

2. **CSS Safe Area Padding** (`src/app/globals.css`):
   ```css
   .page-header {
     padding-top: max(16px, env(safe-area-inset-top));
   }

   .bottom-nav {
     padding-bottom: max(12px, env(safe-area-inset-bottom));
   }
   ```

---

### Step 5: Setting Up GitHub Actions for Windows-Only Workflow

You do **NOT** need a Mac desktop for day-to-day development. You can use **GitHub Actions** (`macos-latest` runner) to compile your `.ipa` and deliver builds directly to **Apple TestFlight**.

#### Sample GitHub Actions Workflow (`.github/workflows/ios-build.yml`)
```yaml
name: Build & Deploy iOS to TestFlight

on:
  push:
    branches: [ master ]

jobs:
  build-ios:
    runs-on: macos-latest

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install Dependencies
        run: npm ci

      - name: Build Next.js Static Export
        run: npm run build

      - name: Add and Sync Capacitor iOS Platform
        run: |
          npm install @capacitor/ios
          npx cap add ios
          npx cap sync ios

      - name: Build iOS App with Xcode CLI
        run: |
          xcodebuild -workspace ios/App/App.xcworkspace \
                     -scheme App \
                     -sdk iphoneos \
                     -configuration Release \
                     -archivePath $PWD/build/App.xcarchive archive

      - name: Export & Upload to TestFlight
        env:
          APP_STORE_CONNECT_API_KEY: ${{ secrets.APP_STORE_CONNECT_API_KEY }}
        run: |
          # Fastlane or xcrun altool upload command to TestFlight
          echo "Uploaded to TestFlight successfully!"
```

---

## 4. Testing Strategies on Windows

| Method | Best Used For | Setup Required |
| :--- | :--- | :--- |
| **Chrome DevTools Mobile Mode** | UI Layout, Forms, Buttons, SQLite queries | Press `F12` in browser |
| **Apple TestFlight** | Real iPhone testing (OCR speed, touch gestures) | GitHub CI automatically uploads build to your phone |
| **Appetize.io** | Interactive iOS Simulator inside Chrome on Windows | Upload iOS `.app` zip built by GitHub Actions |
| **Android Studio Emulator** | Cross-platform Capacitor APIs (Filesystem, Camera) | Android Studio on Windows |

---

## 5. Final App Store Connect Submission Checklist

When you are ready to release Myser on the App Store:

- [ ] **Apple Developer Program Account**: Active membership ($99/year).
- [ ] **1024x1024 App Icon**: PNG format with **no transparency/alpha layer**.
- [ ] **Info.plist Permission Descriptions**:
  - `NSCameraUsageDescription`: *"Myser requires camera access to capture receipt photos for OCR scanning."*
  - `NSPhotoLibraryUsageDescription`: *"Myser requires photo library access to upload existing receipt images."*
- [ ] **Privacy Policy URL**: Hosted HTTPS URL linking to Myser's privacy policy.
- [ ] **App Privacy Details**: Declare financial data, account identifiers, and local storage usage on App Store Connect.
- [ ] **Reviewer Demo Credentials**: Provide a test email/password for Apple's review team to sign in.
