import { useQuery } from '@tanstack/react-query';
import { pacsApi, mapPacsStudyToStudy, mapPacsSeriesToSeries } from '@/services/pacsApi';
import { Study, Series } from '@/lib/mockData';

interface StudyDetailData {
  study: Study;
  series: Series[];
}

export const useStudyDetail = (studyId: string | null) => {
  return useQuery({
    queryKey: ['study', studyId],
    queryFn: async (): Promise<StudyDetailData> => {
      if (!studyId) throw new Error('No study ID provided');

      // Fetch study details, statistics, and series in parallel
      const [study, stats, seriesList] = await Promise.all([
        pacsApi.getStudy(studyId),
        pacsApi.getStudyStatistics(studyId),
        pacsApi.getStudySeries(studyId)
      ]);

      // Determine modality from study tags or fallback to first series
      let modality = study.MainDicomTags.Modality;
      if (!modality && seriesList.length > 0) {
        // Find first series with a modality
        const seriesWithModality = seriesList.find(s => s.MainDicomTags.Modality);
        if (seriesWithModality) {
          modality = seriesWithModality.MainDicomTags.Modality;
        }
      }

      const mappedStudy = mapPacsStudyToStudy(study, stats.CountSeries, stats.CountInstances, modality);
      
      // Map series list
      // Note: pacsApi.getStudySeries returns the list of series objects directly
      const mappedSeries = seriesList.map(mapPacsSeriesToSeries);

      return {
        study: mappedStudy,
        series: mappedSeries
      };
    },
    enabled: !!studyId,
  });
};
