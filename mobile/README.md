# Proppros mobile app (Expo)

The iOS and Android app for owners, managers, maintenance staff and tenants. It talks to the same API as the website (`https://proppros.vercel.app/api`) and follows the Strata design rules in `docs/DESIGN_GUIDELINES.md` §10.

| Who | Tabs |
|---|---|
| Owners / managers | Home (rent collected, balances due, open repairs) · Repairs (update status, photos, notes) · Messages · Money (record a payment, add an expense with a receipt photo) · More |
| Maintenance staff | Repairs · More |
| Tenants | Home (balance, pay rent, announcements) · Repairs (report a problem with photos) · Messages · More |

Sign-in uses a bearer token kept in the phone's secure storage (Keychain / Keystore). Signing out on a phone only signs out that phone. Push notifications arrive for new repair requests, status changes, messages, announcements and notices.

## Run it on your phone (no accounts needed)

Use **Node 24** (see `.nvmrc`). Expo SDK 57's dependency tree only installs cleanly with npm 11, which ships with Node 24; CI and EAS builds are pinned to the same version.

1. Install **Expo Go** from the App Store or Play Store.
2. On your computer:
   ```bash
   cd mobile
   npm install
   npx expo start
   ```
3. Scan the QR code with the camera (iPhone) or Expo Go (Android). The app uses the live API, so sign in with your normal Proppros account.

To use a local backend instead, run it on your computer and start Expo with `EXPO_PUBLIC_API_BASE=http://<your-computer's-LAN-IP>:8000/api npx expo start`.

Push notifications don't work in Expo Go or simulators. They need a real build (below).

### Preview in a browser

`npx expo start --web` opens the app at http://localhost:8081. To use a local API, start the backend with `CORS_ORIGINS=http://localhost:8081` and Expo with `EXPO_PUBLIC_API_BASE=http://localhost:8000/api`.

## Builds and store release (your part)

| Step | What you need | Cost |
|---|---|---|
| 1. Expo account + EAS | `npm i -g eas-cli`, `eas login`, then `eas init` in `mobile/` (writes the project ID into `app.json` → `extra.eas.projectId`, which push notifications need) | Free tier is enough to start |
| 2. Test build | `eas build --profile preview --platform android` (APK you can install directly) or `--platform ios` (needs step 3) | Free tier |
| 3. Apple Developer Program | Enroll at developer.apple.com | $99 / year |
| 4. Google Play Console | Register at play.google.com/console | $25 once |
| 5. Store builds | `eas build --profile production --platform all` | — |
| 6. Submit | `eas submit --platform ios` / `--platform android`; fill in the store listing (screenshots, description, privacy policy URL `https://proppros.vercel.app/privacy`) | — |

Store review checklist:
- Apple requires an in-app way to **delete the account** when sign-up is possible in the app. Proppros sign-up happens on the website and the app links there, but add account deletion to More before submitting if Apple asks.
- Privacy labels: the app collects name, email, phone, photos (user-provided) and payment status. No tracking, no ads.
- Rent payments go through Stripe in the browser, which Apple allows for real-world services. No in-app purchase is needed.

The bundle identifiers are `app.proppros.mobile` (iOS and Android). Change them in `app.json` before the first store build if you prefer another.

## Checks

```bash
npm run typecheck          # TypeScript
npx expo install --check   # dependency versions match the Expo SDK
npx expo export --platform android   # full native bundle build
```

## Keeping the SDK current

Expo Go from the app stores only opens projects on the **current** Expo SDK. When Expo releases a new SDK (roughly every 3–4 months), upgrade with:

```bash
npm install expo@~<new-version>
npx expo install --fix
npx expo-doctor
npm run typecheck
```

Store builds made with EAS don't depend on Expo Go, so released apps keep working, but stay within the last two SDKs so Apple and Google accept new submissions.
