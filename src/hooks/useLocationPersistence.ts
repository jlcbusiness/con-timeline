import { useState, useEffect } from 'react';
import type { Location } from '../types/timeline';

const LOCATIONS_STORAGE_KEY = 'timeline-locations';

// Default locations to start with
const DEFAULT_LOCATIONS: Location[] = [
  { id: '1', name: 'Conference Room A', createdAt: new Date() },
  { id: '2', name: 'Conference Room B', createdAt: new Date() },
  { id: '3', name: 'Office', createdAt: new Date() },
  { id: '4', name: 'Home', createdAt: new Date() },
  { id: '5', name: 'Client Site', createdAt: new Date() },
];

export const useLocationPersistence = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load locations from localStorage on mount
  useEffect(() => {
    try {
      const savedLocations = localStorage.getItem(LOCATIONS_STORAGE_KEY);
      if (savedLocations) {
        const parsedLocations = JSON.parse(savedLocations);
        // Convert date strings back to Date objects
        const locationsWithDates = parsedLocations.map((location: any) => ({
          ...location,
          createdAt: new Date(location.createdAt)
        }));
        setLocations(locationsWithDates);
      } else {
        // First time - set default locations
        setLocations(DEFAULT_LOCATIONS);
      }
    } catch (error) {
      console.error('Failed to load locations from localStorage:', error);
      setLocations(DEFAULT_LOCATIONS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save locations to localStorage whenever locations change
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(LOCATIONS_STORAGE_KEY, JSON.stringify(locations));
      } catch (error) {
        console.error('Failed to save locations to localStorage:', error);
      }
    }
  }, [locations, isLoading]);

  const addLocation = (name: string): Location => {
    const newLocation: Location = {
      id: typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : Date.now().toString(),
      name: name.trim(),
      createdAt: new Date()
    };
    setLocations(prevLocations => [...prevLocations, newLocation]);
    return newLocation;
  };

  const updateLocation = (locationId: string, name: string) => {
    setLocations(prevLocations =>
      prevLocations.map(location =>
        location.id === locationId
          ? { ...location, name: name.trim() }
          : location
      )
    );
  };

  const deleteLocation = (locationId: string) => {
    setLocations(prevLocations =>
      prevLocations.filter(location => location.id !== locationId)
    );
  };

  const mergeLocations = (names: string[]) => {
    const normalizedNames = names
      .map(name => name.trim())
      .filter(Boolean);

    const uniqueNames = Array.from(new Set(normalizedNames.map(name => name.toLowerCase())))
      .map(lowerName => normalizedNames.find(name => name.toLowerCase() === lowerName))
      .filter((name): name is string => Boolean(name));

    const addedLocations: Location[] = [];

    setLocations(prevLocations => {
      const existingNames = new Set(prevLocations.map(location => location.name.toLowerCase()));
      const nextLocations = [...prevLocations];

      uniqueNames.forEach(name => {
        if (existingNames.has(name.toLowerCase())) return;

        const newLocation: Location = {
          id: typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : Date.now().toString(),
          name,
          createdAt: new Date()
        };

        existingNames.add(name.toLowerCase());
        nextLocations.push(newLocation);
        addedLocations.push(newLocation);
      });

      return nextLocations;
    });

    return addedLocations;
  };

  const getLocationById = (locationId: string): Location | undefined => {
    return locations.find(location => location.id === locationId);
  };

  const getLocationByName = (name: string): Location | undefined => {
    return locations.find(location => 
      location.name.toLowerCase() === name.toLowerCase()
    );
  };

  return {
    locations,
    isLoading,
    addLocation,
    updateLocation,
    deleteLocation,
    mergeLocations,
    getLocationById,
    getLocationByName
  };
};
