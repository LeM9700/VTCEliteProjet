// src/components/Chatbot.js

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

import "../styles/Chatbot.css";

const Chatbot = () => {
    const [messages, setMessages] = useState([
        { text: "✨ Bienvenue chez VTCLAND, où l’excellence du transport rencontre l’innovation.\n Je suis VTCElite, votre assistant personnel dédié à une expérience haut de gamme, fluide et prestigieuse. Profitez d’un service sur-mesure et d’un confort inégalé.\n Votre trajet est prêt, il ne vous reste plus qu’à me donner les détails ✨", sender: "bot" }
    ]);
    const [step, setStep] = useState(1);
    const [reservation, setReservation] = useState({ 
        name: "", location: "", destination: "", serviceType: "", passengers: "", bags: "", 
        date: "", time: "", payment: "", phone: ""
    });
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);
    const navigate = (url) => window.location.href = url;
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        window.scrollTo(0, 0);
    }, []);

    const sendNotification = async () => {
        try {
            const smsBody = `🚖 Nouvelle réservation :\n👤 ${reservation.name}\n📍 Départ : ${reservation.location}\n📅 Date : ${reservation.date}\n🕒 Heure : ${reservation.time}\n💳 Paiement : ${reservation.payment}\n📞 Contact : ${reservation.phone}`;
        window.location.href = `sms:+33783699229body=${encodeURIComponent(smsBody)}`;
           
        } catch (error) {
            console.error("Erreur lors de l'envoi de la notification:", error);
            console.log(error);
            
        }
    };

    const validatePhoneNumber = (number) => {
        const phoneRegex = /^\+?[0-9]{10,15}$/;
        return phoneRegex.test(number);
    };

    const handleResponse = async (response) => {

        if (!response.trim()) {
            setMessages([...messages, { text: "⚠️ Merci de fournir une réponse valide.", sender: "bot" }]);
            return;
        }

        let newMessages = [...messages, { text: response, sender: "user" }];
        setIsTyping(true);
        setInput("");

        setTimeout(async () => {
            if (step === 1) {
                setReservation({ ...reservation, location: response });
                newMessages.push({ text: "Pouvez-vous me donner votre nom pour la réservation ?", sender: "bot" });
                setStep(2);
            } else if (step === 2) {
                setReservation({ ...reservation, name: response });
                newMessages.push({ text: "Chez VTCLAND, nous avons conçu deux services exclusifs pour répondre à vos besoins : \n\n 🚗 Mise à disposition – Un chauffeur privé à votre entière disposition pour 100€/heure, idéal pour une liberté totale et des déplacements flexibles.\n\n 📍 Trajet direct – Un transport sur-mesure d’un point A à un point B, facturé 3€/km, pour un voyage simple, rapide et efficace.\n\nQuel service vous conviendrait le mieux ?", sender: "bot" });
                setStep(3);
            } else if (step === 3) {
                setReservation({ ...reservation, serviceType: response });
                newMessages.push({ text: "Pouvez-vous m'indiquer le lieu de prise en charge ?", sender: "bot" });
                setStep(4);
            } else if (step === 4) {
                setReservation({ ...reservation, location: response });
                if (reservation.serviceType === "Trajet direct") {
                    newMessages.push({ text: "Pouvez-vous m'indiquer le lieu de destination ?", sender: "bot" });
                    setStep(5);
                } else {
                    newMessages.push({ text: "Combien de passager êtes-vous ?", sender: "bot" });
                    setStep(6);
                }
            } else if (step === 5) {
                setReservation({ ...reservation, destination: response });
                newMessages.push({ text: "Combien de passager êtes-vous ?", sender: "bot" });
                setStep(6);
            } else if (step === 6) {
                setReservation({ ...reservation, passengers: response });
                newMessages.push({ text: "Avez-vous des bagages ?", sender: "bot" });
                setStep(7);
            } else if (step === 7) {
                setReservation({ ...reservation, bags: response });
                if (response.toLowerCase() === "oui") {
                    newMessages.push({ text: "Combien avez-vous de bagages ?", sender: "bot" });
                    setStep(8);
                } else {
                    newMessages.push({ text: "Quelle date souhaitez-vous réserver ?", sender: "bot" });
                    setStep(9);
                }
            } else if (step === 8) {
                setReservation({ ...reservation, bags: response });
                newMessages.push({ text: "Quelle date souhaitez-vous réserver ?", sender: "bot" });
                setStep(9);
            } else if (step === 9) {
                setReservation({ ...reservation, date: response });
                newMessages.push({ text: "À quelle heure souhaitez-vous être pris en charge ?", sender: "bot" });
                setStep(10);
            } else if (step === 10) {
                setReservation({ ...reservation, time: response });
                newMessages.push({ text: "Comment souhaitez-vous régler ?", sender: "bot" });
                setStep(11);
            } else if (step === 11) {
                setReservation({ ...reservation, payment: response });
                newMessages.push({ text: "Quelle est votre numéro de téléphone ?", sender: "bot" });
                setStep(12);
            } else if (step === 12) {
                if (!validatePhoneNumber(response)) {
                    newMessages.push({ text: "Numéro invalide. Veuillez entrer un numéro au format international (+XX XXXXXXXX).", sender: "bot" });
                } else {
                    setReservation({ ...reservation, phone: response });
                    setStep(13);
                    
                    
                }
            } 
            
        
            
            else if (step === 13) {
                setTimeout(() => newMessages.push({ text: `Votre réservation est :\n📍 ${reservation.location}\n👤 ${reservation.name}\n🛣️ Service : ${reservation.serviceType}\n📅 ${reservation.date}\n🕒 ${reservation.time}\n💰 Paiement : ${reservation.payment}\n📞 Téléphone : ${reservation.phone}\nConfirmez-vous votre demande réservation ? `, sender: "bot" }),4000)
                if (response.toLowerCase() === "oui") {
                    try {
                        
                        await addDoc(collection(db, "reservations"), reservation);
                        await sendNotification();
                        newMessages.push({ text: "Merci ! Votre réservation est enregistrée et une demande a été envoyée à notre équipe de planification, une réponse vous sera envoyé dans quelques minutes en vous confirmant la prise en charge et le montant. VTCLAND vous remercie pour votre confiance !", sender: "bot" });
                        setTimeout(() => navigate("https://lem9700.github.io/vtc-redirection/"), 4000);
                    } catch (error) {
                        newMessages.push({ text: "Erreur lors de l'enregistrement. Veuillez réessayer."+ error, sender: "bot" });
                    }
                } else {
                    newMessages.push({ text: "D'accord, votre réservation a été annulée. Nous allons reprendre depuis le début", sender: "bot" });
                    setTimeout(setStep(1),2000)
                }
                
            }

            setMessages(newMessages);
            setIsTyping(false);
        }, 1000);
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
            {messages.map((msg, index) => (
                <motion.div key={index} className={msg.sender === "bot" ? "message bot" : "message user"}>{msg.text}</motion.div>
            ))}
            {isTyping && <div className="typing-indicator">Le bot écrit...</div>}
            {(step === 9) ? (
            <div className="">
                <input type="date" onChange={(e) => setInput(e.target.value)} />
                <button onClick={() => handleResponse(input)}>Envoyer</button>
              </div>  
            ) : (step === 10) ? (
                <div>
                <input type="time" onChange={(e) => setInput(e.target.value)} />
                <button onClick={() => handleResponse(input)}>Envoyer</button>
                </div>
            ) : (step === 1 || step === 3 || step === 6 || step === 7 ||step === 8 || step === 11 || step === 13) ? (
                <div className="button-options">
                    {step === 1 && ["GO !"].map(option => (
                        <button key={option} onClick={() => handleResponse(option)}>{option}</button>
                    ))}
                    {step === 3 && ["Mise à disposition", "Trajet direct"].map(option => (
                        <button key={option} onClick={() => handleResponse(option)}>{option}</button>
                    ))}
                    
                    {step === 6 && ["1", "2","3","4+"].map(option => (
                        <button key={option} onClick={() => handleResponse(option)}>{option}</button>
                    ))}
                    {step === 7 && ["Oui", "Non"].map(option => (
                        <button key={option} onClick={() => handleResponse(option)}>{option}</button>
                    ))}
                     {step === 8 && ["1", "2","3","4+"].map(option => (
                        <button key={option} onClick={() => handleResponse(option)}>{option}</button>
                    ))}
                    {step === 11 && ["Espèces", "CB", "Virement"].map(option => (
                        <button key={option} onClick={() => handleResponse(option)}>{option}</button>
                    ))}
                    {step === 13 && ["Oui", "Non"].map(option => (
                        <button key={option} onClick={() => handleResponse(option)}>{option}</button>
                    ))}
                   
                </div>
            ) : (
                <div className="input-container">
                    <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleResponse(input)} placeholder="Votre réponse..."/>
                    <button onClick={() => handleResponse(input)}>Envoyer</button>
                </div>
            )}<div>{step > 1 && <button onClick={handleBack} className="back-button" >Retour</button>}</div>
            
        </div>
    );
};

export default Chatbot;
