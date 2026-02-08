import { useQuery } from '@tanstack/react-query';
import { pacsApi } from '@/services/pacsApi';
import { Study } from '@/lib/mockData';

export const useStudies = () => {
  return useQuery({
    queryKey: ['studies'],
    queryFn: async (): Promise<Study[]> => {
      // Fetch all studies mapped directly from QIDO-RS response
      // This avoids N+1 requests and improves performance
      const studies = await pacsApi.getAllStudies();
      return studies;
    },
    // Refresh every 30 seconds
    refetchInterval: 30000,
  });
};
