import React, { useEffect, useRef } from "react";

const AddressAutocomplete = ({ onPlaceSelected }) => {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!window.google) return;

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ['geocode'],
      componentRestrictions: { country: 'fr' }
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      onPlaceSelected(place.formatted_address || inputRef.current.value);
    });
  }, []);

  return <input type="text" ref={inputRef} placeholder="Entrez une adresse" />;
};

export default AddressAutocomplete;
