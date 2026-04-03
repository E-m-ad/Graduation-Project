# Flutter Integration Kit

This starter package connects a Flutter application to the AI Rent backend in this repository.

It is organized by concern:

- `lib/src/config`: environment and dependency bootstrapping
- `lib/src/core`: HTTP client, error handling, and secure session storage
- `lib/src/features`: one repository per backend module

The backend contract used here matches the routes in:

- `src/app.js`
- `src/routes/*.js`
- `src/docs/openapi.js`

Important backend details already wired into this starter:

- Base API prefix: `/api/v1`
- Access token: returned in the login response body
- Refresh token: stored in the `refreshToken` cookie
- Avatar upload field: `avatar`
- Product image upload field: `images`
- OpenAPI JSON: `/api/v1/docs/openapi.json`

Recommended development base URLs:

- Android emulator: `http://10.0.2.2:3000/api/v1`
- iOS simulator: `http://127.0.0.1:3000/api/v1`
- Real device: `http://<your-lan-ip>:3000/api/v1`

Start the example shell:

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1
```

The detailed integration guides are exported in both languages here:

- `docs/flutter-integration/flutter-backend-integration-en.pdf`
- `docs/flutter-integration/flutter-backend-integration-ar.pdf`
