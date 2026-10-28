import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { JobCard, categories, jobs } from '@/components/jobs';

export default function JobsScreen() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const visibleJobs = useMemo(() => jobs.filter((job) => {
    const matchesQuery = `${job.title} ${job.company} ${job.location} ${job.category}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (category === 'All' || category === job.category);
  }), [category, query]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.heading}>
        <View><Text style={styles.eyebrow}>EASYEARN • MALAYSIA</Text><Text style={styles.title}>Find your next gig</Text></View>
        <View style={styles.avatar}><Text style={styles.avatarText}>E</Text></View>
      </View>
      <Text style={styles.subtitle}>Flexible work, closer to you.</Text>
      <View style={styles.search}>
        <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} tintColor="#64748b" size={20} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Role, location or keyword" placeholderTextColor="#94a3b8" style={styles.searchInput} returnKeyType="search" />
      </View>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Explore categories</Text><Text style={styles.smallLabel}>Browse</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
        {categories.map((item) => {
          const selected = category === item.name;
          return <Text key={item.name} onPress={() => setCategory(item.name)} style={[styles.category, selected && styles.categorySelected]}>{item.icon}  {item.name}</Text>;
        })}
      </ScrollView>
      <View style={styles.hero}>
        <View style={styles.heroMark}><Text style={styles.heroMarkText}>MY</Text></View>
        <Text style={styles.heroEyebrow}>WORK YOUR WAY</Text>
        <Text style={styles.heroTitle}>Find jobs.{"\n"}Earn your day.</Text>
        <Text style={styles.heroBody}>Discover flexible opportunities from local employers across Malaysia.</Text>
      </View>
      <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Jobs to explore</Text><Text style={styles.sectionSub}>{visibleJobs.length} sample opportunities</Text></View><Text style={styles.sampleTag}>SAMPLE</Text></View>
      {visibleJobs.map((job) => <JobCard key={job.id} job={job} />)}
      {visibleJobs.length === 0 && <Text style={styles.empty}>No sample jobs match. Try another search.</Text>}
      <Text style={styles.disclaimer}>Preview listings only. Live jobs will appear after we connect the approved backend.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f8fc' }, content: { padding: 20, paddingBottom: 32 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  eyebrow: { color: '#07849a', fontSize: 11, fontWeight: '800', letterSpacing: 1.3 }, title: { color: '#102a43', fontSize: 27, fontWeight: '800', marginTop: 5 },
  subtitle: { color: '#64748b', fontSize: 15, marginTop: 5 }, avatar: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#cffafe' }, avatarText: { color: '#087f8c', fontSize: 19, fontWeight: '800' },
  search: { minHeight: 54, backgroundColor: '#fff', borderColor: '#e2e8f0', borderWidth: 1, borderRadius: 15, marginTop: 22, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 10 }, searchInput: { flex: 1, color: '#102a43', fontSize: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 12 }, sectionTitle: { fontSize: 18, fontWeight: '800', color: '#102a43' }, sectionSub: { color: '#718096', fontSize: 12, marginTop: 3 }, smallLabel: { fontSize: 12, color: '#07849a', fontWeight: '700' },
  categoryRow: { gap: 9, paddingBottom: 2 }, category: { overflow: 'hidden', borderColor: '#dbe5ef', borderWidth: 1, color: '#526579', backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 12, fontWeight: '700' }, categorySelected: { color: '#fff', backgroundColor: '#07849a', borderColor: '#07849a' },
  hero: { backgroundColor: '#073b4c', borderRadius: 22, padding: 22, marginTop: 22, overflow: 'hidden' }, heroMark: { position: 'absolute', right: -18, top: -21, width: 130, height: 130, borderRadius: 65, backgroundColor: '#0b5661', alignItems: 'center', justifyContent: 'center' }, heroMarkText: { color: '#3bd3c4', opacity: 0.65, fontSize: 34, fontWeight: '900' }, heroEyebrow: { color: '#79e2d2', fontSize: 10, letterSpacing: 1.7, fontWeight: '800' }, heroTitle: { color: '#fff', fontSize: 29, lineHeight: 34, fontWeight: '800', marginTop: 9 }, heroBody: { color: '#c2d8df', fontSize: 13, lineHeight: 20, marginTop: 9, maxWidth: 260 },
  sampleTag: { color: '#ad6810', backgroundColor: '#fff1d6', overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, fontSize: 9, letterSpacing: 0.8, fontWeight: '800' }, empty: { textAlign: 'center', color: '#64748b', padding: 24 }, disclaimer: { color: '#8291a2', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 14 },
});
