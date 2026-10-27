// Keep database categories compatible with existing report constraints.
// Store the specific reason in the description for admin review and search.
export const REPORT_REASONS = [
  { id: 'fake_job', type: 'fake_job', label: 'Fake or misleading job' },
  { id: 'payment', type: 'scam', label: 'Unpaid, late or insufficient payment' },
  { id: 'scam', type: 'scam', label: 'Scam or upfront fee request' },
  { id: 'harassment', type: 'harassment', label: 'Harassment or abusive behaviour' },
  { id: 'discrimination', type: 'other', label: 'Discrimination' },
  { id: 'unsafe_work', type: 'other', label: 'Unsafe working conditions' },
  { id: 'changed_terms', type: 'other', label: 'Work differs from agreed terms' },
  { id: 'other', type: 'other', label: 'Other' }
];

export function getReportReason(id) {
  return REPORT_REASONS.find((reason) => reason.id === id);
}

export function reportReasonOptions() {
  return '<option value="">— Select a reason —</option>' + REPORT_REASONS
    .map(({ id, label }) => `<option value="${id}">${label}</option>`).join('');
}
