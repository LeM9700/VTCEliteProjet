import React, { useEffect, useRef } from 'react';

const AddressAutocomplete = ({ onPlaceSelected }) => {
    const inputRef = useRef(null);
    const autocompleteRef = useRef(null);

    useEffect(() => {
        // Chargement asynchrone de l'API Google Maps
        const loadGoogleMaps = () => {
            return new Promise((resolve, reject) => {
                if (window.google) {
                    resolve();
                    return;
                }

                const script = document.createElement('script');
                script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}&libraries=places&loading=async`;
                script.async = true;
                script.defer = true;
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        };

        const initializeAutocomplete = async () => {
            try {
                await loadGoogleMaps();
                
                if (!window.google || !window.google.maps || !window.google.maps.places) {
                    console.error('Google Maps API non chargée correctement');
                    return;
                }

                autocompleteRef.current = new window.google.maps.places.Autocomplete(
                    inputRef.current,
                    {
                        types: ['address'],
                        componentRestrictions: { country: 'fr' }
                    }
                );

                autocompleteRef.current.addListener('place_changed', () => {
                    const place = autocompleteRef.current.getPlace();
                    if (place && place.formatted_address) {
                        onPlaceSelected(place.formatted_address);
                    }
                });
            } catch (error) {
                console.error('Erreur lors du chargement de Google Maps:', error);
            }
        };

        initializeAutocomplete();

        return () => {
            if (autocompleteRef.current) {
                window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
            }
        };
    }, [onPlaceSelected]);

    return (
        <input
            ref={inputRef}
            type="text"
            placeholder="Entrez une adresse"
            className="address-input"
        />
    );
};

export default AddressAutocomplete;
