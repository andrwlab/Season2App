import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import type { Auth, UserCredential } from "firebase/auth";

let pendingSignIn: Promise<UserCredential> | null = null;

// Keep the originating tab and URL throughout the popup flow. In particular,
// do not start a second redirect when a mobile popup is cancelled or blocked:
// GitHub Pages does not proxy Firebase's cross-origin redirect storage.
export const signInWithGoogle = (auth: Auth): Promise<UserCredential> => {
  if (pendingSignIn) return pendingSignIn;
  const originWindow = window;
  const returnUrl = originWindow.location.href;
  const provider = new GoogleAuthProvider();

  pendingSignIn = signInWithPopup(auth, provider)
    .then((credential) => {
      if (originWindow.location.href !== returnUrl) {
        originWindow.history.replaceState(originWindow.history.state, "", returnUrl);
        originWindow.dispatchEvent(new PopStateEvent("popstate"));
      }
      // Safari may foreground a previously open spectator tab when it closes
      // the Google popup. Request focus for the tab that started sign-in.
      originWindow.focus();
      return credential;
    })
    .finally(() => { pendingSignIn = null; });

  return pendingSignIn;
};
