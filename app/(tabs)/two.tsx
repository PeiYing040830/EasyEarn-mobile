import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import { JobCard, categories, jobs } from '@/components/jobs';

export default function ExploreScreen() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const visibleJobs = useMemo(() => jobs.filter((job) => {
    const matchesQuery = `${job.title} ${job.company} ${job.location} ${job.category}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (category === 'All' || category === job.category);
  }), [category, query]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>OPPORTUNITIES</Text>
      <Text style={styles.title}>Browse jobs</Text>
      <Text style={styles.subtitle}>Explore flexible work across Malaysia.</Text>
      <TextInput value={query} onChangeText={setQuery} placeholder="Search role, location or keyword" placeholderTextColor="#94a3b8" style={styles.search} returnKeyType="search" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
        {categories.map((item) => <Text key={item.name} onPress={() => setCategory(item.name)} style={[styles.pill, category === item.name && styles.selected]}>{item.icon}  {item.name}</Text>)}
      </ScrollView>
      <Text style={styles.count}>{visibleJobs.length} opportunities <Text style={styles.preview}>  DEMO PREVIEW</Text></Text>
      {visibleJobs.map((job) => <JobCard key={job.id} job={job} />)}
      {visibleJobs.length === 0 && <Text style={styles.empty}>No sample jobs match. Try a different keyword or category.</Text>}
      <Text style={styles.disclaimer}>These are sample listings. Location services and live job data are not connected yet.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: '#f5f8fc' }, content: { padding: 20, paddingTop: 26, paddingBottom: 32 }, eyebrow: { color: '#07849a', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 }, title: { color: '#102a43', fontSize: 29, fontWeight: '800', marginTop: 7 }, subtitle: { color: '#64748b', fontSize: 14, marginTop: 5 }, search: { height: 52, backgroundColor: '#fff', borderColor: '#e2e8f0', borderWidth: 1, borderRadius: 14, paddingHorizontal: 15, color: '#102a43', marginTop: 20 }, categories: { gap: 8, paddingVertical: 16 }, pill: { overflow: 'hidden', borderColor: '#dbe5ef', borderWidth: 1, color: '#526579', backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9, fontSize: 11, fontWeight: '700' }, selected: { color: '#fff', backgroundColor: '#07849a', borderColor: '#07849a' }, count: { color: '#102a43', fontSize: 16, fontWeight: '800', marginBottom: 12 }, preview: { color: '#a0640e', backgroundColor: '#fff1d6', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, fontSize: 9, fontWeight: '800', letterSpacing: 0.6 }, empty: { color: '#64748b', textAlign: 'center', padding: 24 }, disclaimer: { color: '#8291a2', textAlign: 'center', fontSize: 11, lineHeight: 16, marginTop: 8 } });
