# EasyEarn Flutter

Current Android mobile implementation of EasyEarn, using Flutter and a bundled WebView site. The existing Expo project at repository root is retained separately.

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
