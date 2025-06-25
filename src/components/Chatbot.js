// src/components/Chatbot.js

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { collection, addDoc, doc, setDoc, increment, where, query, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase/functions/firebaseConfig";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import emailjs from 'emailjs-com';




import "../styles/Chatbot.css";

const prestations = [
  "Coupe homme",
  "Coloration",
  "Barbe",
  "Coupe + Barbe",
  "Coupe + Coloration",
  "Coloration + Barbe",
  "Coupe + Coloration + Barbe",
];

const Chatbot = () => {
     const [messages, setMessages] = useState([
    { text: "💇‍♀️ Bienvenue chez RaïHair ! Je suis votre assistant HairBot pour réserver un rendez-vous coiffure. Prêt(e) à prendre soin de vous ? ✨", sender: "bot" }
  ]);
  const [step, setStep] = useState(1);
  const [reservation, setReservation] = useState({
    name: "",
    prestation: "",
    date: "",
    time: "",
    phone: "",
    sentAt: "",
    status: "en attente"
  });
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [smsStep, setSmsStep] = useState(false);
  const navigate = (url) => window.location.href = url;


   
      
      
      

   useEffect(() => {
  if (!window.recaptchaVerifier && document.getElementById('recaptcha-container')) {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      'size': 'invisible',
      'callback': (response) => {
        console.log("reCAPTCHA résolu :", response);
      },
      'expired-callback': () => {
        console.warn("reCAPTCHA expiré. Rechargez la page.");
      }
    });
    window.recaptchaVerifier.render();
  }
  return () => {
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
      window.recaptchaVerifier = null;
    }
  };
}, []);
      
    


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
    

    const handleResponse = async (response) => {
        if (!response.trim()) {
            setMessages([...messages, { text: "⚠️ Merci de fournir une réponse valide.", sender: "bot" }]);
            return;
        }
        const escapedResponse = escapeSpecialChars(response);
        let newMessages = [...messages, { text: response, sender: "user" }];
        setIsTyping(true);
        setInput("");

        setTimeout(async () => {
            if (step === 1) {
                if (response.toLowerCase() === "oui") {
          newMessages.push({ text: "Quel est votre prénom ?", sender: "bot" });;
          setStep(2);
        } else {
          newMessages.push({ text: "D'accord, à bientôt chez RaïHair !", sender: "bot" });
          setMessages(newMessages);
          setIsTyping(false);
          return;
        }
      } else if (step === 2) {
                setReservation({ ...reservation, name: escapedResponse });
                newMessages.push({ text: "Quelle prestation souhaitez-vous ? (Coupe, Brushing, Couleur, Balayage...)", sender: "bot" });
                setStep(3);
            } else if (step === 3) {
                setReservation({ ...reservation, prestation: escapedResponse });
                newMessages.push({ text: "À quelle date souhaitez-vous venir ?", sender: "bot" });
                setStep(4);
            } else if (step === 4) {
                const selectedDate = new Date(response);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (selectedDate < today) {
                    newMessages.push({ text: "⚠️ Veuillez sélectionner une date valide (à partir d'aujourd'hui).", sender: "bot" });
                    setMessages(newMessages);
                    setIsTyping(false);
                    return;
                }
                setReservation({ ...reservation, date: escapedResponse });
                newMessages.push({ text: "À quelle heure souhaitez-vous votre rendez-vous ?", sender: "bot" });
                setStep(5);
            } else if (step === 5) {
                setReservation({ ...reservation, time: escapedResponse });
                newMessages.push({ text: "Quel est votre numéro de téléphone ?", sender: "bot" });
                setStep(6);
            } else if (step === 6) {
                let formattedPhone = String(response).trim();
        if (!formattedPhone.startsWith("+")) {
          formattedPhone = "+33" + formattedPhone.slice(1);
        }
        if (!validatePhoneNumber(formattedPhone)) {
          newMessages.push({ text: "Numéro invalide. Veuillez entrer un numéro au format international (+XX XXXXXXXX).", sender: "bot" });
          setMessages(newMessages);
          setIsTyping(false);
          return;
        }
        setReservation({ ...reservation, phone: formattedPhone });
        // Envoi du SMS
        try {
          const appVerifier = window.recaptchaVerifier;
          const confirmation = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
          setConfirmationResult(confirmation);
          setSmsStep(true);
          newMessages.push({ text: "Un code de vérification vient d'être envoyé par SMS. Merci de le saisir ci-dessous :", sender: "bot" });
        } catch (error) {
          newMessages.push({ text: "Erreur lors de l'envoi du SMS : " + error.message, sender: "bot" });
        }
        setMessages(newMessages);
        setIsTyping(false);
        return;
      }
      // Vérification du code SMS
      if (smsStep) {
        try {
          await confirmationResult.confirm(response);
          setSmsStep(false);
          newMessages.push({
            text: `Merci ${reservation.name} ! Voici le récapitulatif de votre demande :
\n💇‍♀️ Prestation : ${reservation.prestation}
\n📅 Date : ${reservation.date}
\n🕒 Heure : ${reservation.time}
\n📞 Téléphone : ${reservation.phone}
\nConfirmez-vous la réservation ?`,
            sender: "bot"
          });
          setStep(7);
        } catch (error) {
          newMessages.push({ text: "Code incorrect. Merci de réessayer.", sender: "bot" });
        }
        setMessages(newMessages);
        setIsTyping(false);
        return;
      } else if (step === 7) {
                if (response.toLowerCase() === "oui") {
                    try {
                        const now = new Date();
                        const formattedDate = now.toLocaleDateString('fr-FR');
                        setReservation({ ...reservation, sentAt: formattedDate });
                        await addDoc(collection(db, "reservations"), reservation);
                         // Vérification de créneau déjà réservé
            const [year, month, day] = reservation.date.split("-");
            const [hour, minute] = reservation.time.split(":");
            const selectedDate = new Date(year, month - 1, day, hour, minute);

            // Créneaux à vérifier : 1h avant et 1h après
            const startTime = new Date(selectedDate.getTime() - 60 * 60 * 1000);
            const endTime = new Date(selectedDate.getTime() + 60 * 60 * 1000);

            // Format pour comparaison (HH:mm)
            const pad = n => n.toString().padStart(2, "0");
            const startStr = `${pad(startTime.getHours())}:${pad(startTime.getMinutes())}`;
            const endStr = `${pad(endTime.getHours())}:${pad(endTime.getMinutes())}`;

            // Requête Firestore pour trouver un créneau déjà pris ce jour-là dans la plage
            const q = query(
                collection(db, "reservations"),
                where("date", "==", reservation.date),
                where("time", ">=", startStr),
                where("time", "<=", endStr)
            );
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                newMessages.push({ text: "Ce créneau est déjà réservé. Merci de choisir une autre heure.", sender: "bot" });
                setMessages(newMessages);
                setIsTyping(false);
                return;
            }

                        // Ajout ou mise à jour du client dans "clients" avec incrémentation du nombre de visites
                        const clientRef = doc(db, "clients", reservation.phone);
                        await setDoc(
                            clientRef,
                            {
                                name: reservation.name,
                                phone: reservation.phone,
                                createdAt: formattedDate,
                                visites: increment(1)
                            },
                            { merge: true }
                        );

                        // EmailJS params adaptés
                        const templateParams = {
                            name: reservation.name ?? "N/A",
                            prestation: reservation.prestation ?? "N/A",
                            date: reservation.date ?? "N/A",
                            time: reservation.time ?? "N/A",
                            phone: reservation.phone ?? "N/A",
                            sentAt: formattedDate,
                            status: "en attente"
                        };
                        await emailjs.send(
                            'service_sjvypzp',
                            'template_m59xsm7',
                            templateParams,
                            'Er6iVCvQCds16CSph'
                        );
                        newMessages.push({ text: "Votre rendez-vous est enregistré ! Nous vous contacterons pour confirmation. Merci pour votre confiance !", sender: "bot" });
                        setTimeout(() => navigate("/"), 5000);
                    } catch (error) {
                        newMessages.push({ text: "Erreur lors de l'enregistrement. Veuillez réessayer. " + error.message, sender: "bot" });
                    }
                } else {
                    newMessages.push({ text: "Votre réservation a été annulée. On recommence ?", sender: "bot" });
                    setStep(1);
                }
            }
            setMessages(newMessages);
            setIsTyping(false);
        }, 800);
    };

    const handleBack = () => {
        if (step > 1) {
            setStep(step - 1);
            const lastBotMessage = messages.filter(msg => msg.sender === "bot").slice(-2, -1)[0];
            setMessages([...messages, lastBotMessage]);
        }

        
    };

    return (
        
        <div className="chat-container">
      <div id="recaptcha-container"></div>
      {messages.map((msg, index) => (
        <motion.div key={index} className={msg.sender === "bot" ? "message bot" : "message user"}>{msg.text}</motion.div>
      ))}
      {isTyping && <div className="typing-indicator">BotHair écrit...</div>}
      <div ref={messagesEndRef} />
      {(step === 1) ? (
  <div className="button-options">
    {["Oui", "Non"].map(option => (
      <button key={option} onClick={() => handleResponse(option)}>{option}</button>
    ))}
  </div>
) : (step === 4) ? (
        <div>
          <input type="date" value={input || ""} onChange={(e) => setInput(e.target.value)} min={new Date().toISOString().split("T")[0]} />
          <button onClick={() => handleResponse(input)}>Envoyer</button>
        </div>
      ) : (step === 5) ? (
        <div>
          <input type="time" onChange={(e) => setInput(e.target.value)} />
          <button onClick={() => handleResponse(input)}>Envoyer</button>
        </div>
      ) : (step === 3) ? (
        <div className="button-options">
          {prestations.map(option => (
            <button key={option} onClick={() => handleResponse(option)}>{option}</button>
          ))}
        </div>
      ) : (smsStep) ? (
        <div className="input-container">
          <input type="text" value={input || ""} onChange={(e) => setInput(e.target.value)} placeholder="Code SMS" />
          <button onClick={() => handleResponse(input)}>Vérifier</button>
        </div>
      ) : (step === 7) ? (
        <div className="button-options">
          {["Oui", "Non"].map(option => (
            <button key={option} onClick={() => handleResponse(option)}>{option}</button>
          ))}
        </div>
      ) : (
        <div className="input-container">
          <input type="text" value={input || ""}onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleResponse(input)} placeholder="Votre réponse..." />
          <button onClick={() => handleResponse(input)}>Envoyer</button>
        </div>
      )}
      <div>{step > 1 && <button onClick={handleBack} className="back-button">Retour</button>}</div>
      {errorMessage && <div className="error-message">{errorMessage}</div>}
    </div>
    );
};

export default Chatbot;