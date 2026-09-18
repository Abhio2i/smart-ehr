/**
 * Record Filtering & Query Utilities
 * Provides filtering, sorting, and search helpers for ePCR records
 */

/**
 * Filter records by status
 * @param {Array} records - Records to filter
 * @param {string} status - Status to filter by (DRAFT, IN_PROGRESS, COMPLETED, etc.)
 * @returns {Array} Filtered records
 */
export const filterRecordsByStatus = (records, status) => {
  if (!status || status === 'ALL') return records;
  return records.filter(r => r.status === status);
};

/**
 * Filter records by organization
 * @param {Array} records - Records to filter
 * @param {string} orgId - Organization ID
 * @returns {Array} Filtered records
 */
export const filterRecordsByOrganization = (records, orgId) => {
  if (!orgId) return records;
  return records.filter(r => r.organizationId === orgId);
};

/**
 * Filter records by paramedic
 * @param {Array} records - Records to filter
 * @param {string} paramedicsId - Paramedic ID
 * @returns {Array} Filtered records
 */
export const filterRecordsByParamedic = (records, paramedicsId) => {
  if (!paramedicsId) return records;
  return records.filter(r => r.paramedicsId === paramedicsId);
};

/**
 * Filter records by QA approval status
 * @param {Array} records - Records to filter
 * @param {boolean} approved - Whether to get approved or unapproved
 * @returns {Array} Filtered records
 */
export const filterRecordsByQAApproval = (records, approved) => {
  if (approved === null || approved === undefined) return records;
  return records.filter(r => r.qaApproved === approved);
};

/**
 * Search records by patient name or other text fields
 * @param {Array} records - Records to search
 * @param {string} searchTerm - Search term
 * @returns {Array} Matching records
 */
export const searchRecords = (records, searchTerm) => {
  if (!searchTerm || searchTerm.trim() === '') return records;
  
  const term = searchTerm.toLowerCase();
  return records.filter(r => 
    r.patientName?.toLowerCase().includes(term) ||
    r.incidentLocation?.toLowerCase().includes(term) ||
    r.incidentDescription?.toLowerCase().includes(term) ||
    r.diagnosis?.toLowerCase().includes(term) ||
    r.id?.toLowerCase().includes(term)
  );
};

/**
 * Filter records by date range
 * @param {Array} records - Records to filter
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Filtered records
 */
export const filterRecordsByDateRange = (records, startDate, endDate) => {
  return records.filter(r => {
    const recDate = new Date(r.incidentDateTime || r.createdAt);
    if (startDate && recDate < startDate) return false;
    if (endDate && recDate > endDate) return false;
    return true;
  });
};

/**
 * Sort records by field
 * @param {Array} records - Records to sort
 * @param {string} field - Field to sort by
 * @param {string} direction - 'ASC' or 'DESC'
 * @returns {Array} Sorted records
 */
export const sortRecords = (records, field = 'createdAt', direction = 'DESC') => {
  return [...records].sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];
    
    if (aVal === undefined || aVal === null) return direction === 'ASC' ? 1 : -1;
    if (bVal === undefined || bVal === null) return direction === 'ASC' ? -1 : 1;
    
    if (typeof aVal === 'string') {
      return direction === 'ASC' 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    
    return direction === 'ASC' ? aVal - bVal : bVal - aVal;
  });
};

/**
 * Paginate records
 * @param {Array} records - Records to paginate
 * @param {number} page - Page number (0-based)
 * @param {number} size - Page size
 * @returns {Object} { data, totalPages, currentPage }
 */
export const paginateRecords = (records, page = 0, size = 20) => {
  const start = page * size;
  const end = start + size;
  const data = records.slice(start, end);
  const totalPages = Math.ceil(records.length / size);
  
  return {
    data,
    totalPages,
    currentPage: page,
    totalElements: records.length,
    hasNext: page < totalPages - 1,
    hasPrev: page > 0,
  };
};

/**
 * Apply multiple filters and sorting at once
 * @param {Array} records - Records to filter
 * @param {Object} filters - Filter options
 * @param {string} filters.status - Status filter
 * @param {string} filters.organizationId - Org filter
 * @param {string} filters.paramedicsId - Paramedic filter
 * @param {boolean} filters.qaApproved - QA approval filter
 * @param {string} filters.searchTerm - Search term
 * @param {Date} filters.startDate - Start date
 * @param {Date} filters.endDate - End date
 * @param {string} filters.sortBy - Sort field
 * @param {string} filters.direction - Sort direction
 * @param {number} filters.page - Page number
 * @param {number} filters.size - Page size
 * @returns {Object} Filtered, sorted, and paginated records
 */
export const applyRecordFilters = (
  records,
  filters = {}
) => {
  const {
    status,
    organizationId,
    paramedicsId,
    qaApproved,
    searchTerm,
    startDate,
    endDate,
    sortBy = 'createdAt',
    direction = 'DESC',
    page = 0,
    size = 20,
  } = filters;

  let filtered = records;

  // Apply all filters
  if (status) filtered = filterRecordsByStatus(filtered, status);
  if (organizationId) filtered = filterRecordsByOrganization(filtered, organizationId);
  if (paramedicsId) filtered = filterRecordsByParamedic(filtered, paramedicsId);
  if (qaApproved !== null && qaApproved !== undefined) {
    filtered = filterRecordsByQAApproval(filtered, qaApproved);
  }
  if (searchTerm) filtered = searchRecords(filtered, searchTerm);
  if (startDate || endDate) filtered = filterRecordsByDateRange(filtered, startDate, endDate);

  // Sort
  filtered = sortRecords(filtered, sortBy, direction);

  // Paginate
  return paginateRecords(filtered, page, size);
};

/**
 * Build query string from filters for API calls
 * @param {Object} filters - Filter options
 * @returns {string} Query string
 */
export const buildFilterQueryString = (filters = {}) => {
  const params = new URLSearchParams();
  
  if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
  if (filters.organizationId) params.append('organizationId', filters.organizationId);
  if (filters.paramedicsId) params.append('paramedicsId', filters.paramedicsId);
  if (filters.searchTerm) params.append('search', filters.searchTerm);
  if (filters.page !== undefined) params.append('page', filters.page);
  if (filters.size !== undefined) params.append('size', filters.size);
  if (filters.sortBy) params.append('sortBy', filters.sortBy);
  if (filters.direction) params.append('direction', filters.direction);

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
};
