import { 
  signInWithPhoneNumber,
  RecaptchaVerifier,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth } from '../functions/firebaseConfig';
import { firebaseService } from './firebaseService';

class AuthService {
  // Initialiser le reCAPTCHA
  initializeRecaptcha(containerId) {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA résolu
      }
    });
  }

  // Authentification par téléphone
  async signInWithPhone(phoneNumber) {
    try {
      if (!window.recaptchaVerifier) {
        throw new Error('reCAPTCHA non initialisé');
      }

      const confirmationResult = await signInWithPhoneNumber(
        auth,
        phoneNumber,
        window.recaptchaVerifier
      );

      return confirmationResult;
    } catch (error) {
      console.error('Erreur lors de l\'authentification par téléphone:', error);
      throw error;
    }
  }

  // Vérifier le code de confirmation
  async confirmCode(confirmationResult, code) {
    try {
      const result = await confirmationResult.confirm(code);
      return result.user;
    } catch (error) {
      console.error('Erreur lors de la confirmation du code:', error);
      throw error;
    }
  }

  // Déconnexion
  async signOut() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      throw error;
    }
  }

  // Écouter les changements d'état d'authentification
  onAuthStateChange(callback) {
    return onAuthStateChanged(auth, (user) => {
      if (user) {
        // L'utilisateur est connecté
        callback(user);
      } else {
        // L'utilisateur est déconnecté
        callback(null);
      }
    });
  }

  // Vérifier si l'utilisateur est authentifié
  isAuthenticated() {
    return auth.currentUser !== null;
  }

  // Obtenir l'utilisateur actuel
  getCurrentUser() {
    return auth.currentUser;
  }
}

export const authService = new AuthService(); 