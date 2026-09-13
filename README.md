# Market Vision - Firebase Version

## What changed
- Products now use Cloud Firestore.
- Admin login now uses Firebase Authentication.
- Products are shared across devices and browsers.
- Add/Delete operations are protected behind Firebase login.

## Firebase Console setup

### 1. Authentication
Firebase Console → Authentication → Sign-in method → Enable **Email/Password**.

Then go to Authentication → Users → Add user.

Use that email and password on `login.html`.

### 2. Firestore Database
Firebase Console → Firestore Database → Create database.

After creation, open **Rules** and paste the contents of `firestore.rules`.

### 3. Important
Do not use the old localStorage product system anymore.

## Running locally
Because this project uses JavaScript ES modules, run it through a local server such as VS Code Live Server or deploy it to Firebase Hosting / Netlify / GitHub Pages.

Do not simply double-click the HTML files using `file://`.
