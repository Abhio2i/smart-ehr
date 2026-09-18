import client from '../client';

export const patientAnalyticsService = {
  getSummary: async (organizationId, startDate, endDate, refresh = false) => {
    const params = {};
    if (organizationId) params.organizationId = organizationId;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (refresh) params.refresh = true;
    const response = await client.get('/api/reports/patients/summary', { params, hideToast: true });
    return response.data;
  },

  getFastCount: async (organizationId) => {
    const params = organizationId ? { organizationId } : {};
    const response = await client.get('/api/reports/patients/count', { params, hideToast: true });
    return response.data;
  },
};

export default patientAnalyticsService;
