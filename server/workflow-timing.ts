import { WorkflowNode } from '@/lib/db/schema';

/**
 * Calculate when a prospect should be scheduled for the next node
 * based on the current timing block (delay, waitUntil, timeSlot)
 */
export function calculateNextScheduledTime(
  node: WorkflowNode,
  currentTime: Date = new Date()
): Date {
  const config = node.config as any;

  switch (node.type) {
    case 'delay': {
      const amount = config.amount || 0;
      const unit = config.unit || 'days';
      
      const scheduledTime = new Date(currentTime);
      
      switch (unit) {
        case 'minutes':
          scheduledTime.setMinutes(scheduledTime.getMinutes() + amount);
          break;
        case 'hours':
          scheduledTime.setHours(scheduledTime.getHours() + amount);
          break;
        case 'days':
          scheduledTime.setDate(scheduledTime.getDate() + amount);
          break;
        case 'weeks':
          scheduledTime.setDate(scheduledTime.getDate() + (amount * 7));
          break;
      }
      
      return scheduledTime;
    }

    case 'waitUntil': {
      if (!config.waitUntil) {
        return currentTime;
      }
      return new Date(config.waitUntil);
    }

    case 'timeSlot': {
      const hours = config.hours || [];
      const days = config.days || [];
      
      if (hours.length === 0 || days.length === 0) {
        return currentTime;
      }

      const dayMap: { [key: string]: number } = {
        'Sun': 0,
        'Mon': 1,
        'Tue': 2,
        'Wed': 3,
        'Thu': 4,
        'Fri': 5,
        'Sat': 6,
      };

      const allowedDayNumbers = days.map((d: string) => dayMap[d]).filter((n: number) => n !== undefined);
      const sortedHours = [...hours].sort((a: number, b: number) => a - b);

      let candidateTime = new Date(currentTime);

      for (let i = 0; i < 14; i++) {
        const dayOfWeek = candidateTime.getDay();
        
        if (allowedDayNumbers.includes(dayOfWeek)) {
          const currentHour = candidateTime.getHours();
          const validHour = sortedHours.find((h: number) => h > currentHour);
          
          if (validHour !== undefined) {
            candidateTime.setHours(validHour, 0, 0, 0);
            return candidateTime;
          }
        }

        candidateTime.setDate(candidateTime.getDate() + 1);
        candidateTime.setHours(0, 0, 0, 0);
      }

      return candidateTime;
    }

    default:
      return currentTime;
  }
}

/**
 * Check if a node is a timing node that requires scheduling
 */
export function isTimingNode(nodeType: string): boolean {
  return ['delay', 'waitUntil', 'timeSlot'].includes(nodeType);
}

/**
 * Check if a scheduled time has passed (prospect is ready to continue)
 */
export function isReadyToExecute(scheduledFor: Date | null): boolean {
  if (!scheduledFor) return true;
  return new Date() >= new Date(scheduledFor);
}
