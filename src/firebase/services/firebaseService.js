import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  deleteDoc, 
  doc,
  getDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../functions/firebaseConfig';

class FirebaseService {
  // Créer une nouvelle réservation
  async createReservation(reservationData) {
    try {
      const reservationWithTimestamp = {
        ...reservationData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: 'pending'
      };
      
      const docRef = await addDoc(collection(db, 'reservations'), reservationWithTimestamp);
      return { id: docRef.id, ...reservationWithTimestamp };
    } catch (error) {
      console.error('Erreur lors de la création de la réservation:', error);
      throw error;
    }
  }

  // Récupérer les réservations d'un utilisateur
  async getUserReservations(userId) {
    try {
      const q = query(
        collection(db, 'reservations'),
        where('userId', '==', userId)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Erreur lors de la récupération des réservations:', error);
      throw error;
    }
  }

  // Mettre à jour une réservation
  async updateReservation(reservationId, updateData) {
    try {
      const reservationRef = doc(db, 'reservations', reservationId);
      const updateWithTimestamp = {
        ...updateData,
        updatedAt: serverTimestamp()
      };
      await updateDoc(reservationRef, updateWithTimestamp);
      return { id: reservationId, ...updateWithTimestamp };
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la réservation:', error);
      throw error;
    }
  }

  // Supprimer une réservation
  async deleteReservation(reservationId) {
    try {
      await deleteDoc(doc(db, 'reservations', reservationId));
      return { id: reservationId, deleted: true };
    } catch (error) {
      console.error('Erreur lors de la suppression de la réservation:', error);
      throw error;
    }
  }

  // Récupérer une réservation par ID
  async getReservationById(reservationId) {
    try {
      const docRef = doc(db, 'reservations', reservationId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        throw new Error('Réservation non trouvée');
      }
    } catch (error) {
      console.error('Erreur lors de la récupération de la réservation:', error);
      throw error;
    }
  }
}

export const firebaseService = new FirebaseService(); 