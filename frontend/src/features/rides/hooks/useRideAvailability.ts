import { useQuery } from '@tanstack/react-query'
import { getRideAvailability } from '../api/ridesApi'

export function useRideAvailability(
  origin: string,
  destination: string,
  month: string,
) {
  return useQuery({
    queryKey: [
      'rides',
      'availability',
      origin,
      destination,
      month,
    ],
    queryFn: () =>
      getRideAvailability(
        origin,
        destination,
        month,
      ),
    enabled: Boolean(origin && destination),
    staleTime: 60_000,
  })
}