/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Middleware pour le rate limiting
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limite chaque IP à 100 requêtes par fenêtre
});

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

// Validation des réservations
exports.validateReservation = functions.https.onCall(async (data, context) => {
  // Vérification de l'authentification
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'L\'utilisateur doit être authentifié'
    );
  }

  // Vérification du numéro de téléphone
  if (!context.auth.token.phone_number) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Le numéro de téléphone doit être vérifié'
    );
  }

  // Validation des données
  const validationErrors = [];
  
  if (!data.name || typeof data.name !== 'string' || data.name.length === 0) {
    validationErrors.push('Le nom est requis');
  }
  
  if (!data.location || typeof data.location !== 'string' || data.location.length === 0) {
    validationErrors.push('Le lieu de départ est requis');
  }
  
  if (!data.destination || typeof data.destination !== 'string' || data.destination.length === 0) {
    validationErrors.push('La destination est requise');
  }
  
  if (!['Trajet classique', 'Trajet Premium', 'Mise à disposition'].includes(data.serviceType)) {
    validationErrors.push('Type de service invalide');
  }
  
  if (!data.passengers || typeof data.passengers !== 'number' || data.passengers < 1 || data.passengers > 8) {
    validationErrors.push('Nombre de passagers invalide');
  }
  
  if (typeof data.bags !== 'number' || data.bags < 0 || data.bags > 10) {
    validationErrors.push('Nombre de bagages invalide');
  }
  
  if (!data.date || !(data.date instanceof admin.firestore.Timestamp)) {
    validationErrors.push('Date invalide');
  }
  
  if (!data.time || typeof data.time !== 'string') {
    validationErrors.push('Heure invalide');
  }
  
  if (!['Espèces', 'CB'].includes(data.payment)) {
    validationErrors.push('Méthode de paiement invalide');
  }
  
  if (!data.phone || !/^\+?[0-9]{10,15}$/.test(data.phone)) {
    validationErrors.push('Numéro de téléphone invalide');
  }
  
  if (!data.prix || typeof data.prix !== 'number' || data.prix <= 0) {
    validationErrors.push('Prix invalide');
  }

  if (validationErrors.length > 0) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Données de réservation invalides',
      { errors: validationErrors }
    );
  }

  return { valid: true };
});

// Fonction pour nettoyer les données sensibles
exports.sanitizeData = functions.https.onCall((data, context) => {
  const sanitizedData = { ...data };
  
  // Nettoyage des entrées utilisateur
  const sanitizeString = (str) => {
    return str.replace(/[<>]/g, '');
  };
  
  if (sanitizedData.name) sanitizedData.name = sanitizeString(sanitizedData.name);
  if (sanitizedData.location) sanitizedData.location = sanitizeString(sanitizedData.location);
  if (sanitizedData.destination) sanitizedData.destination = sanitizeString(sanitizedData.destination);
  
  return sanitizedData;
});

// Fonction pour envoyer des notifications
const sendAdminNotification = async (title, body, type) => {
    try {
        const message = {
            notification: {
                title: title,
                body: body
            },
            data: {
                type: type,
                timestamp: new Date().toISOString()
            },
            topic: 'admin_notifications' // Topic pour les notifications admin
        };

        const response = await admin.messaging().send(message);
        console.log('Notification envoyée avec succès:', response);
    } catch (error) {
        console.error('Erreur lors de l\'envoi de la notification:', error);
    }
};

// Fonction pour suivre l'activité des utilisateurs
exports.trackUserActivity = functions.https.onCall(async (data, context) => {
    const { action, step, reservationId } = data;
    
    let notificationTitle = '';
    let notificationBody = '';
    
    switch(action) {
        case 'started':
            notificationTitle = 'Nouvelle réservation en cours';
            notificationBody = 'Un client a commencé à remplir le formulaire de réservation';
            break;
        case 'abandoned':
            notificationTitle = 'Réservation abandonnée';
            notificationBody = 'Un client a abandonné le formulaire de réservation';
            break;
        case 'completed':
            notificationTitle = 'Nouvelle réservation complétée';
            notificationBody = `Une nouvelle réservation a été effectuée (ID: ${reservationId})`;
            break;
        case 'step_changed':
            notificationTitle = 'Progression de réservation';
            notificationBody = `Un client est à l'étape ${step} du formulaire`;
            break;
    }
    
    await sendAdminNotification(notificationTitle, notificationBody, action);
    
    return { success: true };
});

// Configuration de l'envoi d'emails
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// Fonction pour envoyer l'email de confirmation
exports.sendEmailConfirmation = functions.https.onCall(async (data, context) => {
    const { email, reservation } = data;
    
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `Confirmation de votre réservation VTCLAND - ${reservation.reservationNumber}`,
        html: `
            <h1>Confirmation de votre réservation</h1>
            <p>Bonjour ${reservation.name},</p>
            <p>Votre réservation a bien été enregistrée. Voici les détails :</p>
            
            <h2>Détails de la réservation</h2>
            <ul>
                <li>Numéro de réservation : ${reservation.reservationNumber}</li>
                <li>Date et heure : ${reservation.formattedDate}</li>
                <li>Lieu de prise en charge : ${reservation.location}</li>
                <li>Destination : ${reservation.destination}</li>
                <li>Type de service : ${reservation.serviceType}</li>
                <li>Nombre de passagers : ${reservation.passengers}</li>
                <li>Nombre de bagages : ${reservation.bags}</li>
                <li>Prix estimé : ${reservation.prix} €</li>
            </ul>
            
            <h2>Informations importantes</h2>
            <ul>
                <li>Un chauffeur vous contactera pour confirmer la prise en charge</li>
                <li>Vous pouvez annuler jusqu'à 12 heures avant le départ</li>
                <li>Le prix final pourra être ajusté en fonction du trajet réel</li>
            </ul>
            
            <p>Pour toute question, contactez-nous au 01 23 45 67 89</p>
            
            <p>Cordialement,<br>L'équipe VTCLAND</p>
        `
    };
    
    try {
        await transporter.sendMail(mailOptions);
        return { success: true };
    } catch (error) {
        console.error('Erreur lors de l\'envoi de l\'email:', error);
        throw new functions.https.HttpsError('internal', 'Erreur lors de l\'envoi de l\'email');
    }
});
