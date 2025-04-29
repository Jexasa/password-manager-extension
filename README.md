# Password Manager Chrome Extension

A lightweight, secure Chrome extension to manage your passwords with ease. Store, generate, and autofill passwords—all encrypted locally on your device.

## Features
- **Secure Storage:** Encrypts passwords with 256-bit AES and stores them locally using `chrome.storage.sync`.
- **Password Generator:** Creates strong, random passwords.
- **Autofill:** Seamlessly fills login fields #TO-DO (requires content script setup).
- **Dark Mode:** Toggle between light and dark themes.
- **Minimalist UI:** Simple and intuitive design.

## Usage
- **Setup:** Enter a username and master password to initialize.
- **Save Passwords:** Add site-password pairs in the "Save Password" section.
- **View Passwords:** Check saved credentials under "Saved Passwords."
- **Generate:** Create secure passwords with one click.

## Privacy (TO-DO)
Your data stays on your device. Read our [Privacy Policy](https://yourusername.github.io/password-manager-privacy/policy.md) for details.

## TO-DO features
- **Google Analytics:** Add usage tracking (e.g., popup opens, password saves).
  - Steps: Add `ga-lite.js`, initialize in `popup.js` with your Tracking ID.
- **Ads:** Display ads every hour of inactivity, removable with a $0.50 one-time purchase.
  - Steps: Implement ad logic in `popup.js`, integrate Chrome Web Store payments.
- **Buy Me a Coffee:** Encourage donations via a button or prompt.
  - Steps: Add a "Support Us" button in `mainContent` linking to `https://www.buymeacoffee.com/yourusername`

## License (TO-DO)
