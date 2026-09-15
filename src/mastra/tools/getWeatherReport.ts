import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { loadWeather } from '../lib/loader.ts';
import { Unavailable } from './common.ts';

const Station = z.object({
  name: z.string(),
  distanceKm: z.number(),
  meanWindMph: z.number(),
  maxGustMph: z.number(),
  maxRainMmPerHr: z.number(),
  snowCm: z.number(),
});

const WeatherOut = z.object({
  postcodeDistrict: z.string(),
  dateOfLoss: z.string(),
  window: z.object({ from: z.string(), to: z.string() }),
  namedStorm: z.string().nullable(),
  stations: z.array(Station),
});

export const getWeatherReport = createTool({
  id: 'getWeatherReport',
  description:
    'Returns a postcode-level report from the nearest three stations with mean wind, maximum gust, rainfall and any Met Office named storm. Gusts, not means, are what matter for roofs.',
  inputSchema: z.object({ postcodeDistrict: z.string(), dateOfLoss: z.string() }),
  outputSchema: z.union([WeatherOut, Unavailable]),
  execute: async (inputData) => {
    const w = loadWeather(inputData.postcodeDistrict, inputData.dateOfLoss);
    if (!w) {
      return {
        status: 'unavailable' as const,
        reason: `no weather report on file for ${inputData.postcodeDistrict} on ${inputData.dateOfLoss}`,
      };
    }
    if (w.status === 'unavailable') {
      return { status: 'unavailable' as const, reason: w.reason ?? 'weather source unavailable' };
    }
    return {
      postcodeDistrict: w.postcodeDistrict,
      dateOfLoss: w.dateOfLoss,
      window: w.window,
      namedStorm: w.namedStorm,
      stations: w.stations,
    };
  },
});
