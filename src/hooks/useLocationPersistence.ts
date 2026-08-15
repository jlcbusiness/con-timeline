import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Location } from '../types/timeline';

// Default locations to start with
const DEFAULT_LOCATIONS: Location[] = [
  { id: '1', name: 'Conference Room A', createdAt: new Date() },
  { id: '2', name: 'Conference Room B', createdAt: new Date() },
  { id: '3', name: 'Office', createdAt: new Date() },
  { id: '4', name: 'Home', createdAt: new Date() },
  { id: '5', name: 'Client Site', createdAt: new Date() },
];

const mapLocationRow = (location: any): Location => ({
  id: location.id,
  name: location.name,
  createdAt: new Date(location.created_at || new Date())
});

const buildLocationRow = (location: Location, timelineId: string, userId: string) => ({
  id: location.id,
  timeline_id: timelineId,
  user_id: userId,
  name: location.name,
  details: {},
  created_at: location.createdAt.toISOString(),
  updated_at: location.createdAt.toISOString()
});

export const useLocationPersistence = (activeTimelineId?: string | null) => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadLocations = async () => {
      setIsLoading(true);

      try {
        if (!supabase || !activeTimelineId) {
          setLocations([]);
          return;
        }

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        const user = userData.user;
        if (!user) {
          setLocations([]);
          return;
        }

        const { data, error } = await supabase
          .from('locations')
          .select('*')
          .eq('user_id', user.id)
          .eq('timeline_id', activeTimelineId)
          .order('created_at', { ascending: true });

        if (error) throw error;

        let loadedLocations = (data ?? []).map(mapLocationRow);

        if (loadedLocations.length === 0) {
          const defaults = DEFAULT_LOCATIONS.map(location => ({
            ...location,
            id: typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : `${Date.now()}-${location.id}`
          }));

          const { error: insertError } = await supabase
            .from('locations')
            .insert(defaults.map(location => buildLocationRow(location, activeTimelineId, user.id)));

          if (insertError) throw insertError;

          loadedLocations = defaults;
        }

        if (!cancelled) {
          setLocations(loadedLocations);
        }
      } catch (error) {
        console.error('Failed to load locations', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadLocations();

    return () => {
      cancelled = true;
    };
  }, [activeTimelineId]);

  const persistLocation = async (location: Location) => {
    if (!supabase || !activeTimelineId) return;

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;

    const user = userData.user;
    if (!user) return;

    const { error } = await supabase
      .from('locations')
      .upsert(buildLocationRow(location, activeTimelineId, user.id), { onConflict: 'id' });

    if (error) {
      throw error;
    }
  };

  const addLocation = (name: string): Location => {
    const newLocation: Location = {
      id: typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : Date.now().toString(),
      name: name.trim(),
      createdAt: new Date()
    };
    setLocations(prevLocations => [...prevLocations, newLocation]);

    void persistLocation(newLocation).catch(error => {
      console.error('Failed to add location', error);
    });

    return newLocation;
  };

  const updateLocation = (locationId: string, name: string) => {
    const existingLocation = locations.find(location => location.id === locationId);

    setLocations(prevLocations =>
      prevLocations.map(location =>
        location.id === locationId
          ? { ...location, name: name.trim() }
          : location
      )
    );

    if (existingLocation) {
      void persistLocation({ ...existingLocation, name: name.trim() }).catch(error => {
        console.error('Failed to update location', error);
      });
    }
  };

  const deleteLocation = (locationId: string) => {
    setLocations(prevLocations =>
      prevLocations.filter(location => location.id !== locationId)
    );

    if (supabase && activeTimelineId) {
      void supabase.auth.getUser().then(async ({ data }: any) => {
        const user = data.user;
        if (!user) return;

        const { error } = await supabase
          .from('locations')
          .delete()
          .eq('id', locationId)
          .eq('timeline_id', activeTimelineId)
          .eq('user_id', user.id);

        if (error) {
          console.error('Failed to delete location', error);
        }
      });
    }
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

    if (supabase && activeTimelineId) {
      void supabase.auth.getUser().then(async ({ data }: any) => {
        const user = data.user;
        if (!user) return;

        const existingNames = new Set(locations.map(location => location.name.toLowerCase()));
        const rows = addedLocations.filter(location => !existingNames.has(location.name.toLowerCase()));

        if (rows.length === 0) return;

        const { error } = await supabase
          .from('locations')
          .insert(rows.map(location => buildLocationRow(location, activeTimelineId, user.id)));

        if (error) {
          console.error('Failed to merge locations', error);
        }
      });
    }

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
