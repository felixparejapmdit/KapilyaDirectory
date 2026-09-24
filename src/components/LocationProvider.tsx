'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface UserLocation {
  name: string;
  lat: number;
  lng: number;
  isGps?: boolean;
}

interface LocationContextType {
  location: UserLocation;
  setLocation: (loc: UserLocation) => void;
  detectGps: () => Promise<UserLocation>;
  isDetecting: boolean;
  /** True once the initial location is settled (saved, GPS, or the default after a timeout). */
  ready: boolean;
}

/** Give up waiting on the startup GPS fix (e.g. an unanswered permission prompt) after this long. */
const INITIAL_FIX_TIMEOUT_MS = 4000;

export const POPULAR_CITIES: UserLocation[] = [
  { name: 'Quezon City', lat: 14.6644, lng: 121.0544 },
  { name: 'Metro Manila', lat: 14.5995, lng: 120.9842 },
  { name: 'Manila', lat: 14.5995, lng: 120.9842 },
  { name: 'Caloocan', lat: 14.6571, lng: 120.9841 },
  { name: 'Makati', lat: 14.5547, lng: 121.0244 },
  { name: 'Pasig City', lat: 14.5764, lng: 121.0851 },
  { name: 'Cebu City', lat: 10.3157, lng: 123.8854 },
  { name: 'Davao City', lat: 7.1907, lng: 125.4553 },
  { name: 'Baguio City', lat: 16.4023, lng: 120.5960 },
  { name: 'San Fernando, Pampanga', lat: 15.0342, lng: 120.6847 },
  { name: 'Dagupan, Pangasinan', lat: 16.0433, lng: 120.3347 },
  { name: 'Iloilo City', lat: 10.7202, lng: 122.5621 },
  { name: 'Bacolod City', lat: 10.6766, lng: 122.9509 },
  { name: 'Cagayan de Oro', lat: 8.4542, lng: 124.6319 },
  { name: 'General Santos City', lat: 6.1164, lng: 125.1716 },
  { name: 'Los Angeles, CA', lat: 34.0522, lng: -118.2437 },
  { name: 'San Francisco, CA', lat: 37.7749, lng: -122.4194 },
  { name: 'New York, NY', lat: 40.7128, lng: -74.0060 },
  { name: 'Toronto, Canada', lat: 43.6532, lng: -79.3832 },
  { name: 'London, UK', lat: 51.5074, lng: -0.1278 },
  { name: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503 },
  { name: 'Sydney, Australia', lat: -33.8688, lng: 151.2093 },
];

const DEFAULT_LOCATION: UserLocation = POPULAR_CITIES[0]; // Quezon City

const LocationContext = createContext<LocationContextType>({
  location: DEFAULT_LOCATION,
  setLocation: () => {},
  detectGps: async () => DEFAULT_LOCATION,
  isDetecting: false,
  ready: false,
});

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocationState] = useState<UserLocation>(DEFAULT_LOCATION);
  const [isDetecting, setIsDetecting] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Load persisted location from localStorage
    try {
      const saved = localStorage.getItem('kapilya_active_location');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.lat && parsed.lng) {
          setLocationState(parsed);
          setReady(true);
          return;
        }
      }
    } catch (e) {
      console.error('Error reading saved location:', e);
    }

    // Try background geolocation once if not set
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setReady(true);
      return;
    }
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      setReady(true);
    };
    // The browser's timeout doesn't cover a permission prompt left unanswered, so cap it here too.
    const fallback = window.setTimeout(settle, INITIAL_FIX_TIMEOUT_MS);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: UserLocation = {
          name: 'Current Location',
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          isGps: true,
        };
        setLocationState(loc);
        localStorage.setItem('kapilya_active_location', JSON.stringify(loc));
        settle();
      },
      () => {
        // Keep default Quezon City
        settle();
      },
      { timeout: 3500 }
    );
    return () => window.clearTimeout(fallback);
  }, []);

  const setLocation = (loc: UserLocation) => {
    setLocationState(loc);
    try {
      localStorage.setItem('kapilya_active_location', JSON.stringify(loc));
    } catch (e) {
      console.error(e);
    }
  };

  const detectGps = (): Promise<UserLocation> => {
    setIsDetecting(true);
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        setIsDetecting(false);
        alert('Geolocation is not supported by your browser.');
        return reject(new Error('Geolocation unsupported'));
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc: UserLocation = {
            name: 'Current Location',
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            isGps: true,
          };
          setLocation(loc);
          setIsDetecting(false);
          resolve(loc);
        },
        (err) => {
          setIsDetecting(false);
          alert('Could not detect your GPS location. Please allow location permissions or select your city from the list.');
          reject(err);
        },
        { timeout: 8000, enableHighAccuracy: true }
      );
    });
  };

  return (
    <LocationContext.Provider value={{ location, setLocation, detectGps, isDetecting, ready }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useUserLocation() {
  return useContext(LocationContext);
}
