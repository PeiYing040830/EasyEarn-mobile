import { StyleSheet, Text, View } from 'react-native';

export type SampleJob = {
  id: string;
  title: string;
  company: string;
  location: string;
  category: string;
  pay: string;
  schedule: string;
  initials: string;
};

export const categories = [
  { name: 'All', icon: '✦' },
  { name: 'Events', icon: '◈' },
  { name: 'F&B', icon: '☕' },
  { name: 'Education', icon: '▤' },
  { name: 'Delivery', icon: '↗' },
];

// Clearly marked local examples; these are not fetched from a live employer or database.
export const jobs: SampleJob[] = [
  { id: 'sample-event-crew', title: 'Weekend Event Crew', company: 'Community Events', location: 'Kuala Lumpur', category: 'Events', pay: 'RM 15 / hour', schedule: 'Part-time', initials: 'CE' },
  { id: 'sample-service-crew', title: 'Cafe Service Crew', company: 'Neighbourhood Cafe', location: 'Petaling Jaya', category: 'F&B', pay: 'RM 12 / hour', schedule: 'Flexible', initials: 'NC' },
  { id: 'sample-tutor', title: 'Primary English Tutor', company: 'Learning Circle', location: 'Shah Alam', category: 'Education', pay: 'RM 35 / hour', schedule: 'Part-time', initials: 'LC' },
  { id: 'sample-delivery', title: 'Local Delivery Partner', company: 'City Parcel Co.', location: 'Subang Jaya', category: 'Delivery', pay: 'RM 10 / delivery', schedule: 'Flexible', initials: 'CP' },
];

export function JobCard({ job }: { job: SampleJob }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.logo}><Text style={styles.logoText}>{job.initials}</Text></View>
        <View style={styles.jobInfo}><Text style={styles.jobTitle}>{job.title}</Text><Text style={styles.company}>{job.company}</Text></View>
        <Text style={styles.save}>♡</Text>
      </View>
      <View style={styles.meta}><Text style={styles.metaText}>⌖  {job.location}</Text><Text style={styles.metaText}>◷  {job.schedule}</Text></View>
      <View style={styles.cardBottom}><Text style={styles.pay}>{job.pay}</Text><Text style={styles.tag}>{job.category}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderColor: '#e6edf3', borderWidth: 1, borderRadius: 17, padding: 15, marginBottom: 11 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 11 }, logo: { height: 43, width: 43, borderRadius: 13, backgroundColor: '#e0f6f5', alignItems: 'center', justifyContent: 'center' }, logoText: { fontWeight: '800', color: '#087f8c', fontSize: 12 },
  jobInfo: { flex: 1 }, jobTitle: { color: '#18354b', fontWeight: '800', fontSize: 14 }, company: { color: '#718096', fontSize: 12, marginTop: 3 }, save: { color: '#8291a2', fontSize: 23 },
  meta: { flexDirection: 'row', gap: 16, marginTop: 15 }, metaText: { color: '#64748b', fontSize: 11 }, cardBottom: { borderTopWidth: 1, borderTopColor: '#edf1f5', marginTop: 13, paddingTop: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, pay: { color: '#087f8c', fontWeight: '800', fontSize: 13 }, tag: { overflow: 'hidden', color: '#526579', backgroundColor: '#f1f5f9', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, fontSize: 10, fontWeight: '700' },
});
