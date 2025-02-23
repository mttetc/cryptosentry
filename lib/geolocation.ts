'use client';

export async function getUserCountry(): Promise<string> {
  if (typeof window === 'undefined') {
    return 'Unknown';
  }

  try {
    const response = await fetch('https://ipapi.co/json/');
    if (!response.ok) {
      throw new Error('Failed to fetch location data');
    }

    const data = await response.json();
    return data.country_name || 'Unknown';
  } catch (error) {
    console.error('Error getting location:', error);
    return 'Unknown';
  }
}
