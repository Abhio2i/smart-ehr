import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import client, { extractErrorMessage } from '../../api/client';

const asList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const idOf = (item) => item?.id || item?.conditionId || item?.medicationId || item?.encounterId || item?.admissionId || item?.labResultId || item?.documentId;

const request = async (fn, rejectWithValue, defaultFallback) => {
  try {
    const res = await fn();
    return res.data;
  } catch (e) {
    if (e.response?.status === 404 && defaultFallback !== undefined) {
      return defaultFallback;
    }
    return rejectWithValue(extractErrorMessage(e));
  }
};

export const searchPatients = createAsyncThunk(
  'patientHistory/searchPatients',
  async ({ query = '', limit = 20 } = {}, { rejectWithValue }) => request(() => client.get('/api/admin/patients/search', {
    params: { phone: query, limit },
    hideToast: true,
  }), rejectWithValue)
);

export const fetchPatientHistory = createAsyncThunk(
  'patientHistory/fetchHistory',
  async (patientId, { rejectWithValue }) => request(() => client.get(`/api/patients/${patientId}/history`, { hideToast: true }), rejectWithValue, null)
);

export const fetchPatientTimeline = createAsyncThunk(
  'patientHistory/fetchTimeline',
  async (patientId, { rejectWithValue }) => request(() => client.get(`/api/patients/${patientId}/history/timeline`, { hideToast: true }), rejectWithValue, [])
);

const makeFetch = (name, path) => createAsyncThunk(
  `patientHistory/fetch${name}`,
  async (patientId, { rejectWithValue }) => request(() => client.get(`/api/patients/${patientId}/history/${path}`, { hideToast: true }), rejectWithValue, [])
);

const makeCreate = (name, path) => createAsyncThunk(
  `patientHistory/create${name}`,
  async ({ patientId, data }, { rejectWithValue }) => request(() => client.post(`/api/patients/${patientId}/history/${path}`, data), rejectWithValue)
);

const makeUpdate = (name, path, idKey) => createAsyncThunk(
  `patientHistory/update${name}`,
  async ({ patientId, id, data }, { rejectWithValue }) => request(() => client.put(`/api/patients/${patientId}/history/${path}/${id || data?.[idKey]}`, data), rejectWithValue)
);

const makeDelete = (name, path) => createAsyncThunk(
  `patientHistory/delete${name}`,
  async ({ patientId, id }, { rejectWithValue }) => {
    try {
      await client.delete(`/api/patients/${patientId}/history/${path}/${id}`);
      return id;
    } catch (e) {
      return rejectWithValue(extractErrorMessage(e));
    }
  }
);

export const fetchConditions = makeFetch('Conditions', 'conditions');
export const createCondition = makeCreate('Condition', 'conditions');
export const updateCondition = makeUpdate('Condition', 'conditions', 'conditionId');
export const deleteCondition = makeDelete('Condition', 'conditions');

export const fetchMedications = makeFetch('Medications', 'medications');
export const createMedication = makeCreate('Medication', 'medications');
export const updateMedication = makeUpdate('Medication', 'medications', 'medicationId');
export const deleteMedication = makeDelete('Medication', 'medications');

export const fetchEncounters = makeFetch('Encounters', 'encounters');
export const createEncounter = makeCreate('Encounter', 'encounters');
export const updateEncounter = makeUpdate('Encounter', 'encounters', 'encounterId');
export const deleteEncounter = makeDelete('Encounter', 'encounters');

export const fetchAdmissions = makeFetch('Admissions', 'admissions');
export const createAdmission = makeCreate('Admission', 'admissions');
export const updateAdmission = makeUpdate('Admission', 'admissions', 'admissionId');
export const deleteAdmission = makeDelete('Admission', 'admissions');

export const fetchLabResults = makeFetch('LabResults', 'lab-results');
export const createLabResult = makeCreate('LabResult', 'lab-results');
export const updateLabResult = makeUpdate('LabResult', 'lab-results', 'labResultId');
export const deleteLabResult = makeDelete('LabResult', 'lab-results');

export const fetchDocuments = makeFetch('Documents', 'documents');
export const createDocument = makeCreate('Document', 'documents');
export const updateDocument = makeUpdate('Document', 'documents', 'documentId');
export const deleteDocument = makeDelete('Document', 'documents');

export const fetchVitals = makeFetch('Vitals', 'vitals');
export const createVital = makeCreate('Vital', 'vitals');
export const updateVital = makeUpdate('Vital', 'vitals', 'id');
export const deleteVital = makeDelete('Vital', 'vitals');

export const fetchClinicalOrders = makeFetch('ClinicalOrders', 'clinical-orders');
export const createClinicalOrder = makeCreate('ClinicalOrder', 'clinical-orders');
export const updateClinicalOrder = makeUpdate('ClinicalOrder', 'clinical-orders', 'id');
export const deleteClinicalOrder = makeDelete('ClinicalOrder', 'clinical-orders');

export const fetchAllPatientHistory = createAsyncThunk(
  'patientHistory/fetchAll',
  async (patientId, { dispatch, rejectWithValue }) => {
    try {
      await Promise.all([
        dispatch(fetchPatientHistory(patientId)).unwrap(),
        dispatch(fetchPatientTimeline(patientId)).unwrap(),
        dispatch(fetchConditions(patientId)).unwrap(),
        dispatch(fetchMedications(patientId)).unwrap(),
        dispatch(fetchEncounters(patientId)).unwrap(),
        dispatch(fetchAdmissions(patientId)).unwrap(),
        dispatch(fetchLabResults(patientId)).unwrap(),
        dispatch(fetchDocuments(patientId)).unwrap(),
        dispatch(fetchVitals(patientId)).unwrap(),
        dispatch(fetchClinicalOrders(patientId)).unwrap(),
      ]);
      return patientId;
    } catch (e) {
      return rejectWithValue(typeof e === 'string' ? e : extractErrorMessage(e));
    }
  }
);

const initialState = {
  currentPatientId: null,
  patientSearchResults: [],
  patientSearchLoading: false,
  summary: null,
  timeline: [],
  conditions: [],
  medications: [],
  encounters: [],
  admissions: [],
  labResults: [],
  documents: [],
  vitals: [],
  clinicalOrders: [],
  loading: false,
  pendingCount: 0,
  error: null,
};

const patientHistorySlice = createSlice({
  name: 'patientHistory',
  initialState,
  reducers: {
    clearHistoryError: (state) => { state.error = null; },
    clearPatientSearch: (state) => { state.patientSearchResults = []; },
    setCurrentPatientId: (state, { payload }) => { state.currentPatientId = payload; },
    clearHistory: (state) => {
      state.currentPatientId = null;
      state.summary = null;
      state.timeline = [];
      state.conditions = [];
      state.medications = [];
      state.encounters = [];
      state.admissions = [];
      state.labResults = [];
      state.documents = [];
      state.vitals = [];
      state.clinicalOrders = [];
      state.error = null;
      state.pendingCount = 0;
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    const pending = (state) => {
      state.pendingCount += 1;
      state.loading = true;
      state.error = null;
    };
    const fulfilled = (state) => {
      state.pendingCount = Math.max(0, state.pendingCount - 1);
      state.loading = state.pendingCount > 0;
    };
    const rejected = (state, action) => {
      state.pendingCount = Math.max(0, state.pendingCount - 1);
      state.loading = state.pendingCount > 0;
      state.error = action.payload || 'Unable to load patient history';
    };
    const upsert = (list, item) => {
      const itemId = idOf(item);
      const idx = list.findIndex((x) => idOf(x) === itemId);
      if (idx >= 0) list[idx] = item;
      else list.unshift(item);
    };
    const remove = (list, id) => list.filter((x) => idOf(x) !== id);

    builder
      .addCase(searchPatients.pending, (state) => {
        state.patientSearchLoading = true;
        state.error = null;
      })
      .addCase(searchPatients.fulfilled, (state, action) => {
        state.patientSearchLoading = false;
        state.patientSearchResults = asList(action.payload);
      })
      .addCase(searchPatients.rejected, (state, action) => {
        state.patientSearchLoading = false;
        state.error = action.payload;
      })

      .addCase(fetchAllPatientHistory.pending, (state) => {
        state.error = null;
      })
      .addCase(fetchAllPatientHistory.fulfilled, (state, action) => {
        state.currentPatientId = action.payload;
        state.error = null;
      })
      .addCase(fetchAllPatientHistory.rejected, (state, action) => {
        state.error = action.payload;
      })

      .addCase(fetchPatientHistory.pending, pending)
      .addCase(fetchPatientHistory.fulfilled, (state, action) => { fulfilled(state); state.summary = action.payload; })
      .addCase(fetchPatientHistory.rejected, rejected)
      .addCase(fetchPatientTimeline.pending, pending)
      .addCase(fetchPatientTimeline.fulfilled, (state, action) => { fulfilled(state); state.timeline = asList(action.payload); })
      .addCase(fetchPatientTimeline.rejected, rejected)
      .addCase(fetchConditions.pending, pending)
      .addCase(fetchConditions.fulfilled, (state, action) => { fulfilled(state); state.conditions = asList(action.payload); })
      .addCase(fetchConditions.rejected, rejected)
      .addCase(fetchMedications.pending, pending)
      .addCase(fetchMedications.fulfilled, (state, action) => { fulfilled(state); state.medications = asList(action.payload); })
      .addCase(fetchMedications.rejected, rejected)
      .addCase(fetchEncounters.pending, pending)
      .addCase(fetchEncounters.fulfilled, (state, action) => { fulfilled(state); state.encounters = asList(action.payload); })
      .addCase(fetchEncounters.rejected, rejected)
      .addCase(fetchAdmissions.pending, pending)
      .addCase(fetchAdmissions.fulfilled, (state, action) => { fulfilled(state); state.admissions = asList(action.payload); })
      .addCase(fetchAdmissions.rejected, rejected)
      .addCase(fetchLabResults.pending, pending)
      .addCase(fetchLabResults.fulfilled, (state, action) => { fulfilled(state); state.labResults = asList(action.payload); })
      .addCase(fetchLabResults.rejected, rejected)
      .addCase(fetchDocuments.pending, pending)
      .addCase(fetchDocuments.fulfilled, (state, action) => { fulfilled(state); state.documents = asList(action.payload); })
      .addCase(fetchDocuments.rejected, rejected)

      .addCase(createCondition.fulfilled, (state, action) => { upsert(state.conditions, action.payload); })
      .addCase(updateCondition.fulfilled, (state, action) => { upsert(state.conditions, action.payload); })
      .addCase(deleteCondition.fulfilled, (state, action) => { state.conditions = remove(state.conditions, action.payload); })
      .addCase(createMedication.fulfilled, (state, action) => { upsert(state.medications, action.payload); })
      .addCase(updateMedication.fulfilled, (state, action) => { upsert(state.medications, action.payload); })
      .addCase(deleteMedication.fulfilled, (state, action) => { state.medications = remove(state.medications, action.payload); })
      .addCase(createEncounter.fulfilled, (state, action) => { upsert(state.encounters, action.payload); })
      .addCase(updateEncounter.fulfilled, (state, action) => { upsert(state.encounters, action.payload); })
      .addCase(deleteEncounter.fulfilled, (state, action) => { state.encounters = remove(state.encounters, action.payload); })
      .addCase(createAdmission.fulfilled, (state, action) => { upsert(state.admissions, action.payload); })
      .addCase(updateAdmission.fulfilled, (state, action) => { upsert(state.admissions, action.payload); })
      .addCase(deleteAdmission.fulfilled, (state, action) => { state.admissions = remove(state.admissions, action.payload); })
      .addCase(createLabResult.fulfilled, (state, action) => { upsert(state.labResults, action.payload); })
      .addCase(updateLabResult.fulfilled, (state, action) => { upsert(state.labResults, action.payload); })
      .addCase(deleteLabResult.fulfilled, (state, action) => { state.labResults = remove(state.labResults, action.payload); })
      .addCase(createDocument.fulfilled, (state, action) => { upsert(state.documents, action.payload); })
      .addCase(updateDocument.fulfilled, (state, action) => { upsert(state.documents, action.payload); })
      .addCase(deleteDocument.fulfilled, (state, action) => { state.documents = remove(state.documents, action.payload); })

      .addCase(fetchVitals.pending, pending)
      .addCase(fetchVitals.fulfilled, (state, action) => { fulfilled(state); state.vitals = asList(action.payload); })
      .addCase(fetchVitals.rejected, rejected)
      .addCase(createVital.fulfilled, (state, action) => { upsert(state.vitals, action.payload); })
      .addCase(updateVital.fulfilled, (state, action) => { upsert(state.vitals, action.payload); })
      .addCase(deleteVital.fulfilled, (state, action) => { state.vitals = remove(state.vitals, action.payload); })

      .addCase(fetchClinicalOrders.pending, pending)
      .addCase(fetchClinicalOrders.fulfilled, (state, action) => { fulfilled(state); state.clinicalOrders = asList(action.payload); })
      .addCase(fetchClinicalOrders.rejected, rejected)
      .addCase(createClinicalOrder.fulfilled, (state, action) => { upsert(state.clinicalOrders, action.payload); })
      .addCase(updateClinicalOrder.fulfilled, (state, action) => { upsert(state.clinicalOrders, action.payload); })
      .addCase(deleteClinicalOrder.fulfilled, (state, action) => { state.clinicalOrders = remove(state.clinicalOrders, action.payload); });
  },
});

export const { clearHistoryError, clearPatientSearch, setCurrentPatientId, clearHistory } = patientHistorySlice.actions;

export const selectHistorySummary = (state) => state.patientHistory.summary;
export const selectTimeline = (state) => state.patientHistory.timeline;
export const selectConditions = (state) => state.patientHistory.conditions;
export const selectActiveConditions = (state) => state.patientHistory.conditions.filter((c) => c.status === 'ACTIVE');
export const selectResolvedConditions = (state) => state.patientHistory.conditions.filter((c) => c.status === 'RESOLVED');
export const selectMedications = (state) => state.patientHistory.medications;
export const selectEncounters = (state) => state.patientHistory.encounters;
export const selectAdmissions = (state) => state.patientHistory.admissions;
export const selectLabResults = (state) => state.patientHistory.labResults;
export const selectDocuments = (state) => state.patientHistory.documents;
export const selectVitals = (state) => state.patientHistory.vitals;
export const selectClinicalOrders = (state) => state.patientHistory.clinicalOrders;
export const selectHistoryLoading = (state) => state.patientHistory.loading;
export const selectHistoryError = (state) => state.patientHistory.error;
export const selectCurrentPatientId = (state) => state.patientHistory.currentPatientId;
export const selectPatientSearchResults = (state) => state.patientHistory.patientSearchResults;
export const selectPatientSearchLoading = (state) => state.patientHistory.patientSearchLoading;

export default patientHistorySlice.reducer;
