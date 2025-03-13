// firebase/functions/index.js

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const twilio = require("twilio");
require("dotenv").config();


admin.initializeApp();
const db = admin.firestore();

// Twilio Credentials (Remplacé par des variables d'environnement)
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioClient = twilio(accountSid, authToken);
const twilioNumber = process.env.TWILIO_NUMBER;
const adminNumber = process.env.ADMIN_NUMBER;

exports.sendWhatsAppNotification = functions.firestore
    .document("reservations/{reservationId}")
    .onCreate(async (snap, context) => {
        const data = snap.data();

        const messageAdmin = `🚖 Nouvelle réservation :\n\n👤 Client : ${data.name}\n📍 Départ : ${data.location}\n📍 Destination : ${data.destination || "N/A"}\n🛣️ Service : ${data.serviceType}\n🧳 Bagages : ${data.bags}\n👥 Passagers : ${data.passengers}\n📅 Date : ${data.date}\n🕒 Heure : ${data.time}\n💳 Paiement : ${data.payment}\n📞 Contact : ${data.phone}`;

        try {
            await twilioClient.messages.create({
                from: twilioNumber,
                to: adminNumber,
                body: messageAdmin
            });
            console.log("Message WhatsApp envoyé à l'admin");
        } catch (error) {
            console.error("Erreur lors de l'envoi du message WhatsApp", error);
        }
    });
