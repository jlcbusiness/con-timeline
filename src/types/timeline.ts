export interface TimelineEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  color: string;
  position: number; // 0-9 for vertical stacking (10 slots)
}

export interface TimeSlot {
  time: Date;
  events: TimelineEvent[];
}

export interface TimelineConfig {
  startDate: Date;
  endDate: Date;
  hourHeight: number;
  eventColors: string[];
}

export interface Location {
  id: string;
  name: string;
  createdAt: Date;
}
