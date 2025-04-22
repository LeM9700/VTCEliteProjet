import React, { useEffect, useRef, useState } from "react";



const AddressAutocomplete = ({ onPlaceSelected }) => {
  const inputRef = useRef(null);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);

  // Charger le script Google Maps avec l'API Places
  useEffect(() => {
    const loadGoogleMapsScript = () => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.onload = () => setIsScriptLoaded(true);  // Marquer le script comme chargé une fois prêt
      document.body.appendChild(script);

      // Nettoyage pour supprimer le script après utilisation
      return () => {
        document.body.removeChild(script);
      };
    };

    // Charger le script une fois au montage
    loadGoogleMapsScript();
  }, []);

  // Initialiser l'autocomplétion lorsque le script est chargé
  useEffect(() => {
    if (!isScriptLoaded || !window.google) return;

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ['geocode'],
      componentRestrictions: { country: 'fr' },
    });

    // Ajouter un listener pour récupérer le lieu sélectionné
    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      onPlaceSelected(place.formatted_address || inputRef.current.value);
    });
  }, [isScriptLoaded]);

  return (
    <input
      type="text"
      ref={inputRef}
      placeholder="Entrez une adresse"
      disabled={!isScriptLoaded}  // Désactiver le champ jusqu'à ce que le script soit chargé
    />
  );
};

export default AddressAutocomplete;
