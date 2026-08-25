export interface TimelineEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  color: string;
  position: number; // zero-based vertical stacking slot
  bufferBeforeMinutes?: number;
  lockTime?: boolean;
  intangible?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CosplayEntry {
  id: string;
  title: string;
  dayKey: string;
  createdAt?: string;
  updatedAt?: string;
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
