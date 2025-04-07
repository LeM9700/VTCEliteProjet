// src/components/Chatbot.js

import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { collection, addDoc } from "firebase/firestore";
import { app, db, auth, functions } from "../firebase/functions/firebaseConfig";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import AddressAutocomplete from "./AddressAutocomplete";
import { setLogLevel } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';

import "../styles/Chatbot.css";

// Configuration des fonctions Firebase
const validateReservation = httpsCallable(functions, 'validateReservation');
const sanitizeData = httpsCallable(functions, 'sanitizeData');
const trackUserActivity = httpsCallable(functions, 'trackUserActivity');

const Chatbot = () => {
    const navigate = useNavigate();
    const [messages, setMessages] = useState([
        { text: "✨ Bienvenue chez VTCLAND, où l'excellence du transport rencontre l'innovation.\n Je suis VTCElite, votre assistant personnel dédié à une expérience haut de gamme, fluide et prestigieuse. Profitez d'un service sur-mesure et d'un confort inégalé.\n Votre trajet est prêt, il ne vous reste plus qu'à me donner les détails ✨", sender: "bot" }
    ]);
    const [step, setStep] = useState(1);
    const [reservation, setReservation] = useState({ 
        name: "", location: "", destination: "", serviceType: "", passengers: "", bags: "", 
        hour:"", date: "", time: "", payment: "", phone: "", prix : ""
    });
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);
    const [hours, setHours] = useState(1);
    const [confirmationResult, setConfirmationResult] = useState(null);
    const [errorMessage, setErrorMessage] = useState("");
    const [showQRCode, setShowQRCode] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    
    // Cache pour les résultats de calcul de distance
    const distanceCache = useRef(new Map());

    // Fonction de navigation
    const navigateTo = useCallback((url) => {
        if (url.startsWith('http')) {
            window.location.href = url;
        } else {
            navigate(url);
        }
    }, [navigate]);

    // Initialisation de reCAPTCHA
    useEffect(() => {
        try {
            window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                'size': 'invisible',
                'callback': (response) => {
                    // reCAPTCHA vérifié
                }
            });
        } catch (error) {
            console.error('Erreur lors de l\'initialisation de reCAPTCHA:', error);
            setErrorMessage('Erreur lors de l\'initialisation de la vérification. Veuillez rafraîchir la page.');
        }
    }, []);

    // Gestion des erreurs Firebase améliorée
    const handleFirebaseError = (error) => {
        console.error('Erreur Firebase détaillée:', {
            code: error.code,
            message: error.message,
            details: error.details
        });

        let errorMessage = 'Une erreur est survenue. Veuillez réessayer.';
        
        switch (error.code) {
            case 'auth/too-many-requests':
                errorMessage = 'Trop de tentatives. Veuillez réessayer plus tard.';
                break;
            case 'auth/invalid-phone-number':
                errorMessage = 'Numéro de téléphone invalide.';
                break;
            case 'auth/invalid-verification-code':
                errorMessage = 'Code de vérification invalide.';
                break;
            case 'functions/internal':
                errorMessage = 'Erreur de connexion au serveur. Veuillez vérifier votre connexion internet.';
                break;
            case 'functions/not-found':
                errorMessage = 'Service temporairement indisponible. Veuillez réessayer plus tard.';
                break;
            default:
                if (error.message) {
                    errorMessage = error.message;
                }
        }
        
        setErrorMessage(errorMessage);
        return false;
    };

    // Fonction pour envoyer le code de vérification avec gestion d'erreur améliorée
    const sendVerificationCode = async (phoneNumber) => {
        try {
            if (!window.recaptchaVerifier) {
                throw new Error('reCAPTCHA non initialisé');
            }

            const appVerifier = window.recaptchaVerifier;
            const confirmation = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
            setConfirmationResult(confirmation);
            return true;
        } catch (error) {
            return handleFirebaseError(error);
        }
    };

    // Fonction pour vérifier le code avec gestion d'erreur améliorée
    const verifyCode = async (code) => {
        try {
            if (!confirmationResult) {
                throw new Error('Aucune confirmation en cours');
            }

            await confirmationResult.confirm(code);
            return true;
        } catch (error) {
            return handleFirebaseError(error);
        }
    };

    // Fonction pour valider la réservation avec gestion d'erreur améliorée
    const validateReservationData = async (data) => {
        try {
            const result = await validateReservation(data);
            if (!result.data) {
                throw new Error('Réponse invalide du serveur');
            }
            return result.data;
        } catch (error) {
            return handleFirebaseError(error);
        }
    };

    // Fonction pour envoyer l'email de confirmation avec gestion d'erreur améliorée
    const sendEmailConfirmation = async () => {
        try {
            if (!reservation.email) {
                throw new Error('Email non fourni');
            }

            const emailFunction = httpsCallable(functions, 'sendEmailConfirmation');
            const result = await emailFunction({
                email: reservation.email,
                reservation: {
                    ...reservation,
                    formattedDate: formatDate(reservation.date + 'T' + reservation.time)
                }
            });

            if (!result.data) {
                throw new Error('Réponse invalide du serveur');
            }

            setEmailSent(true);
            return true;
        } catch (error) {
            return handleFirebaseError(error);
        }
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        window.scrollTo(0, 0);
    }, []);

    // Optimisation du calcul de distance
    const calculateDistanceAndFare = useCallback((origin, destination, serviceType) => {
        const cacheKey = `${origin}-${destination}-${serviceType}`;
        
        // Vérifier le cache
        if (distanceCache.current.has(cacheKey)) {
            const cachedResult = distanceCache.current.get(cacheKey);
            setReservation({ ...reservation, prix: cachedResult.fare });
            setMessages(prevMessages => [
                ...prevMessages,
                { text: `🚗 Distance estimée (par la route) : ${cachedResult.distance} — Tarif prévisionnel : ${cachedResult.fare} € (${serviceType} service)`, sender: "bot" }
            ]);
            return;
        }
        
        const service = new window.google.maps.DistanceMatrixService();
        
        service.getDistanceMatrix({
            origins: [origin],
            destinations: [destination],
            travelMode: window.google.maps.TravelMode.DRIVING,
            unitSystem: window.google.maps.UnitSystem.METRIC
        }, (response, status) => {
            if (status === "OK") {
                const distanceText = response.rows[0].elements[0].distance.text;
                const distanceValue = parseFloat(distanceText.replace(",", "."));
                
                let ratePerKm = serviceType === "Trajet Premium" ? 5 : 3;
                const fare = (distanceValue * ratePerKm).toFixed(2);
                
                // Mettre en cache le résultat
                distanceCache.current.set(cacheKey, {
                    distance: distanceText,
                    fare: fare
                });
                
                setReservation({ ...reservation, prix: fare });
                setMessages(prevMessages => [
                    ...prevMessages,
                    { text: `🚗 Distance estimée (par la route) : ${distanceText} — Tarif prévisionnel : ${fare} € (${serviceType} service)`, sender: "bot" }
                ]);
            } else {
                console.error("Erreur de calcul de distance : ", status);
                setMessages(prevMessages => [
                    ...prevMessages,
                    { text: "⚠️ Désolé, une erreur est survenue lors du calcul de la distance. Veuillez réessayer.", sender: "bot" }
                ]);
            }
        });
    }, [reservation]);

    // Ajout du suivi d'activité
    useEffect(() => {
        // Notifier le début d'une nouvelle réservation
        trackUserActivity({ action: 'started' });
        
        // Nettoyer lors du démontage du composant
        return () => {
            trackUserActivity({ action: 'abandoned' });
        };
    }, []);
    
    // Fonction pour suivre les changements d'étape
    const trackStepChange = async (newStep) => {
        try {
            await trackUserActivity({ 
                action: 'step_changed', 
                step: newStep 
            });
        } catch (error) {
            console.error('Erreur lors du suivi de l\'étape:', error);
        }
    };

    // Fonction optimisée pour la validation et la soumission des réservations
    const handleReservationSubmit = useCallback(async () => {
        try {
            // Nettoyage des données
            const sanitizedReservation = await sanitizeData(reservation);
            
            // Validation côté serveur
            await validateReservation(sanitizedReservation);
            
            // Enregistrement dans Firestore
            await addDoc(collection(db, "reservations"), sanitizedReservation);
            
            setMessages(prevMessages => [
                ...prevMessages,
                { text: "✅ Votre réservation a été enregistrée avec succès !", sender: "bot" }
            ]);
            
            // Notifier la complétion de la réservation
            await trackUserActivity({ 
                action: 'completed', 
                reservationId: reservation.reservationNumber 
            });
            
            // Redirection après un délai
            setTimeout(() => navigateTo("https://lem9700.github.io/vtc-redirection/"), 3000);
        } catch (error) {
            console.error("Erreur lors de la réservation :", error);
            setErrorMessage("Une erreur est survenue lors de la réservation. Veuillez réessayer.");
        }
    }, [reservation, navigateTo]);

    useEffect(() => {
        const dateInput = document.querySelector('input[type="date"]');
        if (dateInput) {
            const today = new Date().toISOString().split("T")[0];
            dateInput.setAttribute("min", today);
        }
    }, []);

    const validatePhoneNumber = (number) => {
        const phoneRegex = /^\+?[0-9]{10,15}$/;
        return phoneRegex.test(number);
    };
    
    // Fonction pour échapper les caractères spéciaux (sécurité contre injection SQL)
    const escapeSpecialChars = (str) => {
        return str.replace(/['"\\]/g, "\\$&");
    };
    
    // Fonction pour mettre à jour les heures en fonction du slider
    const handleHourChange = (event) => {
        setHours(event.target.value);
    };

    const handleResponse = async (response) => {
        if (!response.trim()) {
            setMessages([...messages, { text: "⚠️ Merci de fournir une réponse valide.", sender: "bot" }]);
            return;
        }

        try {
            const sanitizedResponse = await sanitizeData({ text: response });
            const escapedResponse = escapeSpecialChars(sanitizedResponse.text);

            let newMessages = [...messages, { text: response, sender: "user" }];
            setIsTyping(true);
            setInput("");
            setLogLevel("debug"); // Cela activera les logs détaillés de Firebase Firestore

            setTimeout(async () => {
                if (step === 1) {
                    setReservation({ ...reservation, location: escapedResponse });
                    newMessages.push({ text: "Pouvez-vous me donner votre nom pour la réservation ?", sender: "bot" });
                    setStep(2);
                } else if (step === 2) {
                    setReservation({ ...reservation, name: escapedResponse });
                    newMessages.push({ text: "Chez VTCLAND, nous avons conçu deux services exclusifs pour répondre à vos besoins : \n\n 🚗 Mise à disposition – Un chauffeur privé à votre entière disposition, idéal pour une liberté totale et des déplacements flexibles.\n\n 📍 Trajet direct – Un transport sur-mesure d'un point A à un point B, pour un voyage simple, rapide et efficace.\n\nQuel service vous conviendrait le mieux ?", sender: "bot" });
                    setStep(3);
                } else if (step === 3) {
                    setReservation({ ...reservation, serviceType: escapedResponse });
                    newMessages.push({ text: "Pouvez-vous m'indiquer le lieu de prise en charge ?", sender: "bot" });
                    setStep(4)
                    
                } else if (step === 4) {
                    setReservation({ ...reservation, location: escapedResponse });
                    if (reservation.serviceType === "Trajet classique" || reservation.serviceType === "Trajet Premium") {
                        newMessages.push({ text: "Pouvez-vous m'indiquer le lieu de destination ?", sender: "bot" });
                        setStep(5);
                    } 
                    else if (reservation.serviceType === "Mise à disposition") {
                        newMessages.push({ text: "Pouvez-vous m'indiquer le nombre d'heures ?", sender: "bot" });
                        setStep(4.1);
                    }
                    else {
                        newMessages.push({ text: "Combien de passager êtes-vous ?", sender: "bot" });
                        setStep(6);
                    }
                } 
                
                else if (step === 4.1) {
                    setReservation({ ...reservation, hour: escapedResponse });
                    newMessages.push({ text: `Le tarif pour ${response} heure(s) de mise à disposition est de ${response * 80} €`, sender: "bot" });
                    setReservation({ ...reservation, prix: response * 80 });
                    newMessages.push({ text: "Combien de passager êtes-vous ?", sender: "bot" });
                    setStep(6);
                } 
                
                else if (step === 5) {
                    setReservation({ ...reservation, destination: escapedResponse });
                    newMessages.push({ text: "Combien de passager êtes-vous ?", sender: "bot" });
                    setStep(6);
                } else if (step === 6) {
                    setReservation({ ...reservation, passengers: escapedResponse });
                    newMessages.push({ text: "Avez-vous des bagages ?", sender: "bot" });
                    setStep(7);
                } 
               
                else if (step === 7) {
                    setReservation({ ...reservation, bags: escapedResponse });
                    if (response.toLowerCase() === "oui") {
                        newMessages.push({ text: "Combien avez-vous de bagages ?", sender: "bot" });
                        setStep(8);
                    } else {
                        newMessages.push({ text: "Quelle date souhaitez-vous réserver ?", sender: "bot" });
                        setStep(9);
                    }
                } else if (step === 8) {
                    setReservation({ ...reservation, bags: escapedResponse });
                    newMessages.push({ text: "Quelle date souhaitez-vous réserver ?", sender: "bot" });
                    setStep(9);
                } else if (step === 9) {
                    const selectedDate = new Date(response);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (selectedDate < today) {
                        newMessages.push({ text: "⚠️ Veuillez sélectionner une date valide (à partir d'aujourd'hui).", sender: "bot" });
                        setMessages(newMessages);
                        setIsTyping(false);
                        return;
                    }

                    else {setReservation({ ...reservation, date: escapedResponse });
                    newMessages.push({ text: "À quelle heure souhaitez-vous être pris en charge ?", sender: "bot" });
                    setStep(10);}
                } else if (step === 10) {
                    if (reservation.serviceType === "Trajet classique" || reservation.serviceType === "Trajet Premium") {
                        // Appel à la fonction pour calculer la distance et le tarif
                        calculateDistanceAndFare(reservation.location, reservation.destination,reservation.serviceType);}
                     
                    newMessages.push({ text: "Comment souhaitez-vous régler ?", sender: "bot" });
                    setStep(11);
                } else if (step === 11) {
                    setReservation({ ...reservation, payment: escapedResponse });
                    newMessages.push({ text: "Quelle est votre numéro de téléphone ?", sender: "bot" });
                    setStep(12);
                } else if (step === 12) {

                     // Formater le numéro de téléphone en format international
                    let formattedPhone = response.trim();
                    if (!formattedPhone.startsWith("+")) {
                    formattedPhone = "+33" + formattedPhone.slice(1); // Pour la France, ajoutez "+33"
                    }

                    if (!validatePhoneNumber(formattedPhone)) {
                        newMessages.push({ text: "Numéro invalide. Veuillez entrer un numéro au format international (+XX XXXXXXXX).", sender: "bot" });
                        setMessages(newMessages);
                        setIsTyping(false);
                        return;
                    } else {
                        newMessages.push({ text: "📲 Un code de vérification vous a été envoyé par SMS. Veuillez l'entrer pour valider votre réservation.", sender: "bot" });
                        console.log(step);
                        setStep(12.5);
                        
                        if (!window.recaptchaVerifier) {
                            newMessages.push({ text: "⚠️ Erreur : reCAPTCHA non initialisé.", sender: "bot" });
                            console.error("reCAPTCHA non initialisé !");
                            setMessages(newMessages);
                            setIsTyping(false);
                            return;
                        }
                        
                                    
                    
                    }
                } 
                
                else if (step === 12.5) {

                    let formattedPhone = response.trim();
                    if (!formattedPhone.startsWith("+")) {
                    formattedPhone = "+33" + formattedPhone.slice(1);}

                    try {
                            
                            
                        const confirmation = await signInWithPhoneNumber(auth, formattedPhone, window.recaptchaVerifier);
                        
                        
                        setConfirmationResult(confirmation);
                        setStep(12.5);
                        
                    } catch (error) {
                        setErrorMessage("⚠️ Erreur lors de l'envoi du SMS : " + error.message);
                        console.error("Erreur Firebase Auth:", error);
                    }
                       
                    if (confirmationResult){confirmationResult.confirm(response)
                        .then(result => {
                            newMessages.push({ text: "✅ Vérification réussie ! Votre réservation est presque terminée.", sender: "bot" });
                            newMessages.push({ text: "Voulez-vous afficher votre devis ?", sender: "bot" });
                            setReservation({ ...reservation, phone: escapedResponse });
                             setStep(13);
                        })
                        .catch(error => {
                            newMessages.push({ text: "⚠️ Code incorrect. Veuillez réessayer."+ error, sender: "bot" });
                        });}
                    else{newMessages.push({ text: "⚠️ La vérification du code a échoué. Veuillez réessayer plus tard.", sender: "bot" });
                }    
                }
                else if (step=== 13){
                    const reservationNumber = generateReservationNumber();
                    const formattedDate = formatDate(reservation.date + 'T' + reservation.time);
                    
                    const reservationSummary = `
📋 Récapitulatif de votre réservation :

🔢 Numéro de réservation : ${reservationNumber}
👤 Nom : ${reservation.name}
📱 Téléphone : ${reservation.phone}
📍 Lieu de prise en charge : ${reservation.location}
🎯 Destination : ${reservation.destination}
🚗 Type de service : ${reservation.serviceType}
👥 Nombre de passagers : ${reservation.passengers}
🧳 Nombre de bagages : ${reservation.bags}
📅 Date et heure : ${formattedDate}
💰 Prix estimé : ${reservation.prix} €
💳 Mode de paiement : ${reservation.payment}

ℹ️ Important :
- Conservez bien votre numéro de réservation
- Un chauffeur vous contactera pour confirmer la prise en charge
- Le prix final pourra être ajusté en fonction du trajet réel
- Vous pouvez annuler jusqu'à 12 heures avant le départ

Voulez-vous confirmer cette réservation ?`;
                    
                    newMessages.push({ text: reservationSummary, sender: "bot" });
                    setReservation({ ...reservation, reservationNumber: reservationNumber });
                    setStep(14);
                }

                else if (step === 14) {
                    if (response.toLowerCase() === "oui") {
                        try {
                            // Nettoyage et validation des données
                            const sanitizedReservation = await sanitizeData({
                                ...reservation,
                                status: 'En attente',
                                createdAt: new Date(),
                                updatedAt: new Date()
                            });
                            
                            // Validation côté serveur
                            await validateReservation(sanitizedReservation);
                            
                            // Enregistrement dans Firestore
                            await addDoc(collection(db, "reservations"), sanitizedReservation);
                            
                            const confirmationMessage = `
✅ Réservation confirmée !

Votre réservation a été enregistrée avec succès.

🔢 Numéro de réservation : ${reservation.reservationNumber}
💰 Montant estimé : ${reservation.prix} €

📱 Un chauffeur vous contactera dans les plus brefs délais pour confirmer la prise en charge.

ℹ️ Vous pouvez :
- Scanner le QR code ci-dessous pour accéder à votre réservation
- Recevoir le récapitulatif par email
- Consulter le statut de votre réservation sur votre espace client
- Nous contacter au 01 23 45 67 89
- Annuler votre réservation jusqu'à 12 heures avant le départ

💡 Services complémentaires disponibles :
- Service VIP avec accueil personnalisé
- Voiture de luxe sur demande
- Service de conciergerie
- Transfert aéroport avec suivi des vols

Souhaitez-vous recevoir le récapitulatif par email ?`;

                            newMessages.push({ text: confirmationMessage, sender: "bot" });
                            
                            // Redirection après un délai plus court
                            setTimeout(() => {
                                setMessages([...newMessages, { 
                                    text: "Vous allez être redirigé vers notre page de confirmation...", 
                                    sender: "bot" 
                                }]);
                                setTimeout(() => navigate("https://lem9700.github.io/vtc-redirection/"), 2000);
                            }, 3000);
                        } catch (error) {
                            console.error("Erreur lors de l'enregistrement :", error);
                            newMessages.push({ 
                                text: `⚠️ Une erreur est survenue lors de l'enregistrement de votre réservation. Veuillez réessayer ou nous contacter. Erreur : ${error.message}`, 
                                sender: "bot" 
                            });
                        }
                    } else {
                        newMessages.push({ 
                            text: "D'accord, votre réservation a été annulée. Souhaitez-vous recommencer une nouvelle réservation ?", 
                            sender: "bot" 
                        });
                        setStep(15);
                    }
                }

                else if (step === 15) {
                    if (response.toLowerCase() === "oui") {
                        setReservation({ 
                            name: "", location: "", destination: "", serviceType: "", passengers: "", bags: "", 
                            hour:"", date: "", time: "", payment: "", phone: "", prix: "", reservationNumber: ""
                        });
                        setStep(1);
                        setMessages([{ 
                            text: "✨ Bienvenue chez VTCLAND, où l'excellence du transport rencontre l'innovation.\nJe suis VTCElite, votre assistant personnel dédié à une expérience haut de gamme, fluide et prestigieuse. Profitez d'un service sur-mesure et d'un confort inégalé.\nVotre trajet est prêt, il ne vous reste plus qu'à me donner les détails ✨", 
                            sender: "bot" 
                        }]);
                    } else {
                        newMessages.push({ 
                            text: "Merci d'avoir utilisé nos services. À bientôt chez VTCLAND !", 
                            sender: "bot" 
                        });
                        setTimeout(() => navigate("https://lem9700.github.io/vtc-redirection/"), 3000);
                    }
                }

                setMessages(newMessages);
                setIsTyping(false);
            }, 1000);
        } catch (error) {
            console.error("Erreur lors du traitement de la réponse :", error);
            setMessages([...messages, { text: "⚠️ Une erreur est survenue. Veuillez réessayer.", sender: "bot" }]);
            setIsTyping(false);
        }

        // Suivre le changement d'étape
        await trackStepChange(step);
    };

    const handleBack = () => {
        if (step > 1) {
            // Décrémenter l'étape
            const previousStep = step - 1;
            setStep(previousStep);

            // Trouver l'index du dernier message de l'étape précédente
            const lastMessageIndex = messages.reduce((maxIndex, msg, index) => {
                if (msg.step === previousStep) return index;
                return maxIndex;
            }, 0);

            // Ne garder que les messages jusqu'à l'étape précédente
            const messageHistory = messages.slice(0, lastMessageIndex + 1);

            // Nettoyer proprement l'état en fonction de l'étape
            const cleanState = () => {
                // Réinitialiser l'input
                setInput("");

                // Créer une copie de la réservation
                const updatedReservation = { ...reservation };

                // Définir les champs à réinitialiser par étape
                const fieldsToReset = {
                    2: ['location'],
                    4: ['destination'],
                    5: ['serviceType'],
                    6: ['passengers'],
                    7: ['bags'],
                    9: ['date'],
                    10: ['time'],
                    11: ['payment'],
                    12: ['phone'],
                    13: ['prix']
                };

                // Réinitialiser tous les champs des étapes suivantes
                Object.entries(fieldsToReset).forEach(([stepNum, fields]) => {
                    if (Number(stepNum) > previousStep) {
                        fields.forEach(field => {
                            updatedReservation[field] = "";
                        });
                    }
                });

                return updatedReservation;
            };

            // Mettre à jour l'état
            const updatedReservation = cleanState();
            setReservation(updatedReservation);
            setMessages(messageHistory);
            setIsTyping(false);
            setErrorMessage("");

            // Réinitialiser les états spécifiques si nécessaire
            if (previousStep < 12) {
                setConfirmationResult(null);
            }

            // Nettoyer le cache de distance si on revient avant l'étape de sélection d'adresse
            if (previousStep < 4) {
                distanceCache.current.clear();
            }
        }
    };

    // Fonctions utilitaires
    const generateReservationNumber = () => {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `VTC-${timestamp}-${random}`;
    };

    const formatDate = (dateString) => {
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return new Date(dateString).toLocaleDateString('fr-FR', options);
    };

    const generateQRContent = () => {
        return JSON.stringify({
            reservationNumber: reservation.reservationNumber,
            name: reservation.name,
            date: reservation.date,
            time: reservation.time,
            location: reservation.location,
            destination: reservation.destination
        });
    };

    return (
        <div className="chat-container">
            <div id="recaptcha-container"></div>
            {messages.map((msg, index) => (
                <motion.div key={index} className={msg.sender === "bot" ? "message bot" : "message user"}>
                    {msg.text}
                </motion.div>
            ))}
            {isTyping && <div className="typing-indicator">VTCElite écrit...</div>}
            <div ref={messagesEndRef} />
            
            {showQRCode && (
                <div className="qr-code-container">
                    <QRCodeSVG 
                        value={generateQRContent()} 
                        size={200}
                        level="H"
                        includeMargin={true}
                    />
                    <p>Scannez ce QR code pour accéder à votre réservation</p>
                </div>
            )}
            
            {emailSent && (
                <div className="email-confirmation">
                    <p>✅ Le récapitulatif a été envoyé à votre adresse email</p>
                </div>
            )}
            
            {errorMessage && <div className="error-message">{errorMessage}</div>}
            
            <div className="input-container">
                {step === 4 && (
                    <AddressAutocomplete onPlaceSelected={(address) => {
                        setInput(address);
                        handleResponse(address);
                    }} />
                )}
                
                {step === 5 && (
                    <AddressAutocomplete onPlaceSelected={(address) => {
                        setInput(address);
                        handleResponse(address);
                    }} />
                )}
                
                {step === 6 && (
                    <div className="radio-group">
                        <label>
                            <input
                                type="radio"
                                name="passengers"
                                value="1"
                                onChange={(e) => {
                                    setInput(e.target.value);
                                    handleResponse(e.target.value);
                                }}
                            />
                            1 passager
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="passengers"
                                value="2"
                                onChange={(e) => {
                                    setInput(e.target.value);
                                    handleResponse(e.target.value);
                                }}
                            />
                            2 passagers
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="passengers"
                                value="3"
                                onChange={(e) => {
                                    setInput(e.target.value);
                                    handleResponse(e.target.value);
                                }}
                            />
                            3 passagers
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="passengers"
                                value="4"
                                onChange={(e) => {
                                    setInput(e.target.value);
                                    handleResponse(e.target.value);
                                }}
                            />
                            4 passagers
                        </label>
                    </div>
                )}
                
                {step === 7 && (
                    <div className="radio-group">
                        <label>
                            <input
                                type="radio"
                                name="bags"
                                value="oui"
                                onChange={(e) => {
                                    setInput(e.target.value);
                                    handleResponse(e.target.value);
                                }}
                            />
                            Oui
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="bags"
                                value="non"
                                onChange={(e) => {
                                    setInput(e.target.value);
                                    handleResponse(e.target.value);
                                }}
                            />
                            Non
                        </label>
                    </div>
                )}
                
                {step === 8 && (
                    <input
                        type="number"
                        min="1"
                        max="10"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                handleResponse(input);
                            }
                        }}
                        placeholder="Nombre de bagages..."
                        className="number-input"
                    />
                )}
                
                {step === 9 && (
                    <input
                        type="date"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="date-input"
                    />
                )}
                
                {step === 10 && (
                    <input
                        type="time"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        className="time-input"
                    />
                )}
                
                {step === 4.1 && (
                    <input
                        type="range"
                        min="1"
                        max="12"
                        value={hours}
                        onChange={(e) => {
                            setHours(e.target.value);
                            setInput(e.target.value);
                            handleResponse(e.target.value);
                        }}
                        className="range-input"
                    />
                )}
                
                {![4, 5, 6, 7, 8, 9, 10, 4.1].includes(step) && (
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                handleResponse(input);
                            }
                        }}
                        placeholder="Tapez votre message..."
                        className="chat-input"
                    />
                )}
                
                <button 
                    onClick={() => handleResponse(input)}
                    className="send-button"
                >
                    Envoyer
                </button>
            </div>
        </div>
    );
};

export default Chatbot;