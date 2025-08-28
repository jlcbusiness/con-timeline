import type { TimelineEvent } from '../types/timeline';
import { findAvailablePosition, getEventColors } from './timelineUtils';

export const parseDragonConSchedule = (scheduleText: string): TimelineEvent[] => {
  const lines = scheduleText.split('\n').filter(line => line.trim());
  const events: TimelineEvent[] = [];
  const colors = getEventColors();
  let colorIndex = 0;

  // Track categories for consistent coloring
  const categoryColors: { [key: string]: string } = {};

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;

    // Parse the line format: "Event Title - Day, Month Date Time"
    const match = trimmedLine.match(/^(.+?)\s*-\s*(\w+),\s*(\w+)\s+(\d+)\s+(.+)$/);
    if (!match) return;

    const [, title, dayOfWeek, month, day, timeStr] = match;
    
    // Parse time (handle both 12-hour format with AM/PM)
    const timeMatch = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!timeMatch) return;

    const [, hourStr, minuteStr, ampm] = timeMatch;
    let hour = parseInt(hourStr);
    const minute = parseInt(minuteStr);

    // Convert to 24-hour format
    if (ampm.toUpperCase() === 'PM' && hour !== 12) {
      hour += 12;
    } else if (ampm.toUpperCase() === 'AM' && hour === 12) {
      hour = 0;
    }

    // Create date (2025 - FIXED: Use month 8 for September instead of 7 for August)
    const eventDate = new Date(2025, 8, parseInt(day), hour, minute); // September = month 8
    
    // Default 1-hour duration, but adjust for some known longer events
    let duration = 60; // minutes
    if (title.toLowerCase().includes('workshop') || 
        title.toLowerCase().includes('megagame') ||
        title.toLowerCase().includes('singalong')) {
      duration = 90;
    }
    if (title.toLowerCase().includes('live') || 
        title.toLowerCase().includes('karaoke')) {
      duration = 120;
    }

    const endDate = new Date(eventDate.getTime() + duration * 60 * 1000);

    // Determine category for consistent coloring
    let category = 'general';
    const lowerTitle = title.toLowerCase();
    
    if (lowerTitle.includes('star trek') || lowerTitle.includes('trek')) category = 'startrek';
    else if (lowerTitle.includes('buffy') || lowerTitle.includes('hellmouth')) category = 'buffy';
    else if (lowerTitle.includes('bones')) category = 'bones';
    else if (lowerTitle.includes('arrowverse') || lowerTitle.includes('arrow')) category = 'arrowverse';
    else if (lowerTitle.includes('back to the future')) category = 'bttf';
    else if (lowerTitle.includes('science') || lowerTitle.includes('physics') || lowerTitle.includes('astronomy')) category = 'science';
    else if (lowerTitle.includes('nsdm') || lowerTitle.includes('military') || lowerTitle.includes('war')) category = 'military';
    else if (lowerTitle.includes('sewing') || lowerTitle.includes('fiber') || lowerTitle.includes('craft')) category = 'crafts';
    else if (lowerTitle.includes('monty python')) category = 'python';
    else if (lowerTitle.includes('dragon con')) category = 'dragoncon';

    // Assign consistent colors to categories
    if (!categoryColors[category]) {
      categoryColors[category] = colors[colorIndex % colors.length];
      colorIndex++;
    }

    const event: TimelineEvent = {
      id: `dragoncon-${index}-${Date.now()}`,
      title: title.trim(),
      description: `Dragon Con 2025 - ${dayOfWeek}, ${month} ${day}`,
      location: 'Dragon Con',
      startTime: eventDate,
      endTime: endDate,
      color: categoryColors[category],
      position: 0 // Will be calculated when added
    };

    events.push(event);
  });

  return events;
};

export const addDragonConEvents = (
  scheduleText: string, 
  existingEvents: TimelineEvent[],
  addEvent: (event: TimelineEvent) => void
) => {
  const newEvents = parseDragonConSchedule(scheduleText);
  
  newEvents.forEach(event => {
    // Find available position for each event
    const position = findAvailablePosition(existingEvents, event.startTime, event.endTime);
    const eventWithPosition = { ...event, position };
    
    addEvent(eventWithPosition);
    existingEvents.push(eventWithPosition); // Update for next position calculation
  });

  return newEvents.length;
};
