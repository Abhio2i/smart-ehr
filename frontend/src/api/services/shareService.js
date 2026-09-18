import client from '../client';

export const shareService = {
  createShare: async (recordId, shareData) => {
    const res = await client.post(`/api/records/${recordId}/shares`, shareData);
    return res.data;
  },

  getSharesForRecord: async (recordId) => {
    const res = await client.get(`/api/records/${recordId}/shares`);
    return res.data;
  },

  getSharesInbox: async (page = 0, size = 20) => {
    const res = await client.get(`/api/shares/inbox`, { params: { page, size } });
    return res.data;
  },

  getShareById: async (shareId) => {
    const res = await client.get(`/api/shares/${shareId}`);
    return res.data;
  },

  revokeShare: async (shareId) => {
    const res = await client.post(`/api/shares/${shareId}/revoke`);
    return res.data;
  },

  addResponse: async (shareId, responseNotes) => {
    const res = await client.post(`/api/shares/${shareId}/response`, { responseNotes });
    return res.data;
  },

  verifyExternalToken: async (shareId, token) => {
    const res = await client.post(`/api/shares/external/${shareId}/verify`, { token });
    return res.data;
  },

  getExternalShareBundle: async (shareId, accessToken) => {
    const config = accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {};
    const res = await client.get(`/api/shares/external/${shareId}`, config);
    return res.data;
  },

  addExternalResponse: async (shareId, responseNotes, accessToken) => {
    const config = accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {};
    const res = await client.post(`/api/shares/external/${shareId}/respond`, { responseNotes }, config);
    return res.data;
  }
};

export default shareService;
