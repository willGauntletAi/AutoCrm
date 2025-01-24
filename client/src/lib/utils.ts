import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatDateTagValue = (date: Date | string) => {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZoneName: 'short'
  });
};

export const formatDateTime = (date: Date | string) => {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
};


export const parseYMDDateString = (dateString: string) => {
  // I hate dates and I hate js, but formatting the date like this makes it parse the date in the local timezone. Formatting it
  // the way the date input formats it automatically makes it parse the date in UTC.
  const [year, month, day] = dateString.split("-");
  return new Date(Date.parse(`${month}-${day}-${year}`));
}