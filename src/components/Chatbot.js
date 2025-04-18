// src/components/Chatbot.js

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { collection, addDoc } from "firebase/firestore";
import { auth, db } from "../firebase/functions/firebaseConfig";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import AddressAutocomplete from "./AddressAutocomplete";
import { setLogLevel } from "firebase/firestore";



import "../styles/Chatbot.css";

const Chatbot = () => {
    const [messages, setMessages] = useState([
        { text: "✨ Bienvenue chez VTCLAND, où l’excellence du transport rencontre l’innovation.\n Je suis VTCElite, votre assistant personnel dédié à une expérience haut de gamme, fluide et prestigieuse. Profitez d’un service sur-mesure et d’un confort inégalé.\n Votre trajet est prêt, il ne vous reste plus qu’à me donner les détails ✨", sender: "bot" }
    ]);
    const [step, setStep] = useState(1);
    const [reservation, setReservation] = useState({ 
        name: "", location: "", destination: "", serviceType: "", passengers: "", bags: "", 
        hour:"", date: "", time: "", payment: "", phone: "", prix : ""
    });
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);
    const [hours, setHours] = useState(1); // Initialisation de l'heure à 1
    const [confirmationResult, setConfirmationResult] = useState(null);
    const [errorMessage, setErrorMessage] = useState("");
    const navigate = (url) => window.location.href = url;
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        window.scrollTo(0, 0);
    }, []);


    const calculateDistanceAndFare = (origin, destination, serviceType) => {
        const service = new window.google.maps.DistanceMatrixService();
        
        service.getDistanceMatrix({
          origins: [origin],
          destinations: [destination],
          travelMode: window.google.maps.TravelMode.DRIVING,  // Calcul par la route
          unitSystem: window.google.maps.UnitSystem.METRIC  // En kilomètres
        }, (response, status) => {
          if (status === "OK") {
            const distanceText = response.rows[0].elements[0].distance.text;  // Ex: "12.3 km"
            const distanceValue = parseFloat(distanceText.replace(",", "."));  // Convertir en float
            
            // Choisir le tarif en fonction du type de service (Classique ou Premium)
            let ratePerKm = serviceType === "Trajet Premium" ? 5 : 3;  // 5€/km pour Premium, 3€/km pour Classique
            const fare = (distanceValue * ratePerKm).toFixed(2);  // Calcul du tarif
            setReservation({ ...reservation, prix: fare });
            // Affichage du résultat
            setMessages(prevMessages => [
              ...prevMessages,
              { text: `🚗 Distance estimée (par la route) : ${distanceText} — Tarif prévisionnel : ${fare} € (${serviceType} service)`, sender: "bot" }
            ]);
          } else {
            console.error("Erreur de calcul de distance : ", status);
          }
        });
      };
      
      
      

      useEffect(() => {
        if (!window.recaptchaVerifier) {
          window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            'size': 'invisible',
            'callback': (response) => {
              console.log("reCAPTCHA résolu :", response);
            },
            'expired-callback': () => {
              console.warn("reCAPTCHA expiré. Rechargez la page.");
            }
          });
          window.recaptchaVerifier.render().then((widgetId) => {
            window.recaptchaWidgetId = widgetId;
          }).catch((error) => {
            console.error("Erreur lors du rendu du reCAPTCHA :", error);
          });
        }
      }, [auth]);
      
    


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

        // Appliquez l'échappement des caractères spéciaux à l'entrée utilisateur
        const escapedResponse = escapeSpecialChars(response);

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
                newMessages.push({ text: "Chez VTCLAND, nous avons conçu deux services exclusifs pour répondre à vos besoins : \n\n 🚗 Mise à disposition – Un chauffeur privé à votre entière disposition, idéal pour une liberté totale et des déplacements flexibles.\n\n 📍 Trajet direct – Un transport sur-mesure d’un point A à un point B, pour un voyage simple, rapide et efficace.\n\nQuel service vous conviendrait le mieux ?", sender: "bot" });
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
                    let formattedPhone = response.trim();
                    if (!formattedPhone.startsWith("+")) {
                    formattedPhone = "+33" + formattedPhone.slice(1);}

                    try {
                            
                            
                        const confirmation = await signInWithPhoneNumber(auth, formattedPhone, window.recaptchaVerifier);                    
                        setConfirmationResult(confirmation);
                        newMessages.push({ text: "📲 Un code de vérification vous a été envoyé par SMS. Veuillez l’entrer pour valider votre réservation.", sender: "bot" });
                        console.log(step);
                        setStep(13);
                        
                    } catch (error) {
                        setErrorMessage("⚠️ Erreur lors de l'envoi du SMS : " + error.message);
                        console.error("Erreur Firebase Auth:", error);
                    }
                    
                    
                    if (!window.recaptchaVerifier) {
                        newMessages.push({ text: "⚠️ Erreur : reCAPTCHA non initialisé.", sender: "bot" });
                        console.error("reCAPTCHA non initialisé !");
                        setMessages(newMessages);
                        setIsTyping(false);
                        return;
                    }
                    
                                    
                    
                }
            } 
            
            

            
            else if (step=== 13){
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

            else if (step === 14) {
                newMessages.push({ text: "Votre réservation est :\n📍 ${reservation.location}\n👤 ${reservation.name}\n🛣️ Service : ${reservation.serviceType}\n📅 ${reservation.date}\n🕒 ${reservation.time}\n💰 Paiement : ${reservation.payment}\n📞 Téléphone : ${reservation.phone}\n Prix : ${reservation.prix}\nConfirmez-vous votre demande réservation ?" , sender: "bot" })
                setStep(15)
                if (response.toLowerCase() === "oui") {
                    try {
                        
                        await addDoc(collection(db, "reservations"), reservation);
                        newMessages.push({ text: "Merci ! Votre demande réservation est enregistrée et une demande a été envoyée à notre équipe de planification, une réponse vous sera envoyé dans quelques minutes en vous confirmant la prise en charge et le montant. VTCLAND vous remercie pour votre confiance !", sender: "bot" });
                        setTimeout(() => navigate("https://lem9700.github.io/vtc-redirection/"), 7000);
                    } catch (error) {
                        newMessages.push({ text: "Erreur lors de l'enregistrement. Veuillez réessayer."+ error, sender: "bot" });
                    }
                } else {
                    newMessages.push({ text: "D'accord, votre réservation a été annulée. Nous allons reprendre depuis le début", sender: "bot" });
                    setTimeout(setStep(1),2000)
                }
                
            }

            else if (step === 15) {
                
                if (response.toLowerCase() === "oui") {
                    try {
                        
                        await addDoc(collection(db, "reservations"), reservation);
                        newMessages.push({ text: "Merci ! Votre demande réservation est enregistrée et une demande a été envoyée à notre équipe de planification, une réponse vous sera envoyé dans quelques minutes en vous confirmant la prise en charge et le montant. VTCLAND vous remercie pour votre confiance !", sender: "bot" });
                        setTimeout(() => navigate("https://lem9700.github.io/vtc-redirection/"), 7000);
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
            <div id="recaptcha-container"></div>
            {messages.map((msg, index) => (
                <motion.div key={index} className={msg.sender === "bot" ? "message bot" : "message user"}>{msg.text}</motion.div>
            ))}
            {isTyping && <div className="typing-indicator">VTCElite écrit...</div>}
            <div ref={messagesEndRef} />
            {(step === 9) ? (
            <div className="">
                <input type="date" value={input} onChange={(e) => setInput(e.target.value)} min={new Date().toISOString().split("T")[0]} />
                <button onClick={() => handleResponse(input)}>Envoyer</button>
              </div>  
            ) : (step === 10) ? (
                <div>
                <input type="time" onChange={(e) => setInput(e.target.value)} />
                <button onClick={() => handleResponse(input)}>Envoyer</button>
                </div>
            ) : (step === 1 || step === 3 ||step === 4||step === 4.1||step === 5 || step === 6 || step === 7 ||step === 8 || step === 11 ||  step === 12.5 ||step === 13 || step === 14) ? (
                <div className="button-options">
                    {step === 1 && ["GO !"].map(option => (
                        <button key={option} onClick={() => handleResponse(option)}>{option}</button>
                    ))}
                    {step === 3 && ["Trajet classique","Trajet Premium","Mise à disposition"].map(option => (
                        <button key={option} onClick={() => handleResponse(option)}>{option}</button>
                    ))}
                    {(step === 4 )&& (<div><AddressAutocomplete onPlaceSelected={(val) => handleResponse(val)} /></div>)}
                     {(step === 5 ) && (<div><AddressAutocomplete onPlaceSelected={(val) => handleResponse(val)} /></div>)}
                    {step === 6 && ["1", "2","3"].map(option => (
                        <button key={option} onClick={() => handleResponse(option)}>{option}</button>
                    ))}
                    {step === 7 && ["Oui", "Non"].map(option => (
                        <button key={option} onClick={() => handleResponse(option)}>{option}</button>
                    ))}
                     {step === 8 && ["1", "2","3","4+"].map(option => (
                        <button key={option} onClick={() => handleResponse(option)}>{option}</button>
                    ))}
                    {step === 4.1 && (
                        <div>
                        <label>Durée de la mise à disposition (en heures) :</label>
                        <input 
                            type="range" 
                            min="1" 
                            max="48" 
                            value={hours}
                            onChange={handleHourChange} 
                            
                        />
                        <span>{hours} heure(s)</span>
                        <button onClick={() => handleResponse(hours)}>Envoyer</button>
                    </div>
                    )}
                    {step === 11 && ["Espèces", "CB"].map(option => (
                        <button key={option} onClick={() => handleResponse(option)}>{option}</button>
                    ))}

                    {step === 12.5 && (
                            <div>
                            <input type="text" pattern="[0-9]*" inputMode="numeric" maxLength="6" placeholder="Entrez le code de confirmation" onChange={(e) => setInput(e.target.value) } />
                            <button onClick={() => handleResponse(hours)}>Envoyer</button>
                            </div>
                        )}
                    {step === 13 && ["Oui", "Non"].map(option => (
                        <button key={option} onClick={() => handleResponse(option)}>{option}</button>
                    ))}
                    {step === 14 && ["Oui", "Non"].map(option => (
                        <button key={option} onClick={() => handleResponse(option)}>{option}</button>
                    ))}
                   
                </div>
            ) : 
                        
            (
                <div className="input-container">
                    <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleResponse(input)} placeholder="Votre réponse..."/>
                    <button onClick={() => handleResponse(input)}>Envoyer</button>
                </div>
            )}<div>{step > 1 && <button onClick={handleBack} className="back-button" >Retour</button>}</div>
            
            {errorMessage && <div className="error-message">{errorMessage}</div>}

            
        </div>
    );
};

export default Chatbot;