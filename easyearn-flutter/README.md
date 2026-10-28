# EasyEarn Flutter

Android mobile implementation of EasyEarn, using Flutter and a bundled WebView site. The unused Expo prototype has been removed.

## Run

From `easyearn-flutter/`:

```sh
flutter pub get
flutter run
```

## Verify

```sh
flutter test
flutter build apk --debug
```

Android builds use Gradle 8.14 with the current Android Gradle plugin. Android SDK location is configured locally; `android/local.properties` is not committed.

Bundled application pages are in `assets/site/`. Changes here are separate from the website repository. Public Supabase client configuration is included; service credentials, QA account credentials, signing keys and generated builds are excluded.

Recent validation covered role layouts at mobile widths, QA hiring and payment-dispute workflows, ratings, employer verification, cross-account images, and native Android image selection/saving. Email confirmation is intentionally disabled and is not a passing email-delivery test.

The dedicated Supabase QA accounts and their test records were deleted on 28 October 2026. See the [cleanup record](docs/qa-cleanup-2026-10-28.md) for counts and verification.
