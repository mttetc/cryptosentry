'use server';

import { IpApiResponseSchema } from './geolocation-schemas';

export async function getUserCountry(): Promise<string> {
  try {
    const response = await fetch(`https://ipapi.co/json/`, {
      headers: {
        'User-Agent': 'CryptoSentry/1.0',
      },
    });

    if (!response.ok) {
      return 'Unknown';
    }

    const data = await response.json();
    const result = IpApiResponseSchema.safeParse(data);

    if (!result.success) {
      console.error('Invalid API response:', result.error);
      return 'Unknown';
    }

    return result.data.country_name;
  } catch (error) {
    console.error('Error getting location:', error);
    return 'Unknown';
  }
}
