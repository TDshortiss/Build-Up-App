# Build Up for iPhone

The iPhone app is the same web app, wrapped with [Capacitor](https://capacitorjs.com). Its files ship inside the app,
so it opens instantly and works offline. It talks to the same Supabase project as the website, so accounts and
progress are shared.

## One-time setup on your Mac

1. Install **Xcode** from the Mac App Store, open it once and let it install its extra components.
2. In Xcode, go to **Settings > Accounts**, click **+** and sign in with the Apple ID that's in the Apple Developer
   Program.
3. Install Node.js 22 (from nodejs.org) if you don't have it.
4. Get the code and install packages:

   ```sh
   git clone https://github.com/TDshortiss/Build-Up-App.git
   cd Build-Up-App
   npm install
   ```

## Run it on your iPhone

```sh
npm run ios
```

That builds the web app with the iPhone settings in `.env.ios`, copies it into `ios/`, and opens Xcode.

In Xcode:

1. Click **App** in the left sidebar, then the **App** target, then **Signing & Capabilities**.
2. Tick **Automatically manage signing** and pick your team. The bundle ID is `com.builduptraining.app`.
3. Plug in your iPhone (or pick a simulator) at the top of the window and press **Run** (the play button).
   The first time, your iPhone asks you to turn on **Developer Mode** (Settings > Privacy & Security).

## Upload a build to App Store Connect

1. Bump the version if needed: **App target > General > Version** (e.g. 1.0.1) and **Build** (must go up every
   upload: 1, 2, 3…).
2. Run `npm run build:ios` so the latest web code is inside the app.
3. At the top of Xcode pick **Any iOS Device (arm64)**, then **Product > Archive**.
4. When the Organizer opens, choose the archive and click **Distribute App > App Store Connect > Distribute**.
5. After 10–30 minutes the build shows up in App Store Connect under **TestFlight**.

## How the app differs from the website

Everything app-only lives in `src/state/native.ts`:

- Share cards, invite links and "Download my data" use the iPhone share sheet.
- A light tap when you tick an exercise, and a buzz when you finish a session.
- An optional daily training reminder (Me > Settings).
- No "Add to Home Screen" prompt, offline worker or web analytics.
- The Pro card is hidden until Pro is sold through Apple In-App Purchase.
- Sign-up and password emails open builduptraining.com. People confirm there, then sign in in the app.

Web changes reach the iPhone app only when you upload a new build. After changing app code, run `npm run build:ios`
before archiving.
