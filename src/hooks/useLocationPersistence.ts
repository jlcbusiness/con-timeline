import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Location } from '../types/timeline';

const serializeLocation = (location: Location) => ({
  id: location.id,
  name: location.name,
  createdAt: location.createdAt.toISOString()
});

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const createUuid = () => {
  if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
    return (crypto as any).randomUUID();
  }

  if (typeof crypto !== 'undefined' && (crypto as any).getRandomValues) {
    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, char =>
      ((Number(char) ^ ((crypto as any).getRandomValues(new Uint8Array(1))[0] & 15) >> (Number(char) / 4))).toString(16)
    );
  }

  return `10000000-1000-4000-8000-${Date.now().toString(16).padStart(12, '0').slice(-12)}`;
};

const normalizeImportedLocation = (location: any): Location | null => {
  const name = typeof location === 'string' ? location.trim() : String(location?.name || '').trim();

  if (!name) {
    return null;
  }

  const createdAtValue = typeof location === 'object' && location?.createdAt ? new Date(location.createdAt) : new Date();
  const createdAt = Number.isNaN(createdAtValue.getTime()) ? new Date() : createdAtValue;
  const id = typeof location === 'object' && typeof location?.id === 'string' && isUuid(location.id)
    ? location.id
    : createUuid();

  return {
    id,
    name,
    createdAt
  };
};

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

export const readImportedLocations = (file: File) => {
  return new Promise<Location[]>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const importedLocations = JSON.parse(content);

        if (!Array.isArray(importedLocations)) {
          return reject(new Error('Invalid file format: expected array'));
        }

        const validLocations = importedLocations
          .map(normalizeImportedLocation)
          .filter((location): location is Location => Boolean(location));

        resolve(validLocations);
      } catch (error) {
        reject(new Error('Invalid file format'));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

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

        const loadedLocations = (data ?? []).map(mapLocationRow);

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

  const mergeLocations = async (names: string[], timelineId?: string) => {
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

    const targetTimelineId = timelineId || activeTimelineId;

    if (supabase && targetTimelineId) {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const user = userData.user;
      if (!user) return addedLocations;

      const existingNames = new Set(locations.map(location => location.name.toLowerCase()));
      const rows = addedLocations.filter(location => !existingNames.has(location.name.toLowerCase()));

      if (rows.length === 0) return addedLocations;

      const { error } = await supabase
        .from('locations')
        .insert(rows.map(location => buildLocationRow(location, targetTimelineId, user.id)));

      if (error) {
        throw error;
      }
    }

    return addedLocations;
  };

  const exportLocations = () => {
    const dataStr = JSON.stringify(locations.map(serializeLocation), null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `timeline-locations-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importLocations = (file: File, timelineId?: string) => {
    return readImportedLocations(file).then(async importedLocations => {
      if (importedLocations.length === 0) {
        return importedLocations;
      }

      const uniqueByName = Array.from(new Map(importedLocations.map(location => [location.name.toLowerCase(), location])).values());

      const addedLocations: Location[] = [];

      setLocations(prevLocations => {
        const existingNames = new Set(prevLocations.map(location => location.name.toLowerCase()));
        const nextLocations = [...prevLocations];

        uniqueByName.forEach(location => {
          const normalizedName = location.name.toLowerCase();

          if (existingNames.has(normalizedName)) {
            return;
          }

          existingNames.add(normalizedName);
          nextLocations.push(location);
          addedLocations.push(location);
        });

        return nextLocations;
      });

      const targetTimelineId = timelineId || activeTimelineId;

      if (supabase && targetTimelineId && addedLocations.length > 0) {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        const user = userData.user;
        if (!user) return importedLocations;

        const { error } = await supabase
          .from('locations')
          .insert(addedLocations.map(location => buildLocationRow(location, targetTimelineId, user.id)));

        if (error) {
          throw error;
        }
      }

      return importedLocations;
    });
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
    exportLocations,
    importLocations,
    readImportedLocations,
    getLocationById,
    getLocationByName
  };
};
