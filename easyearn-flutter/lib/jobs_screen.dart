import 'package:flutter/material.dart';

import 'job_card.dart';
import 'job_details_screen.dart';
import 'job_listing.dart';
import 'sample_jobs.dart';

const _brand = Color(0xFF0891B2);

class JobsScreen extends StatefulWidget {
  const JobsScreen({
    super.key,
    required this.savedJobIds,
    required this.onSave,
    this.initialCategory = 'All',
  });

  final Set<String> savedJobIds;
  final ValueChanged<String> onSave;
  final String initialCategory;

  @override
  State<JobsScreen> createState() => _JobsScreenState();
}

class _JobsScreenState extends State<JobsScreen> {
  late String _category = widget.initialCategory;
  String _query = '';

  List<JobListing> get _visibleJobs => sampleJobs.where((job) {
    final text =
        '${job.title} ${job.employerName} ${job.location} ${job.category} ${job.jobType}'
            .toLowerCase();
    return (_category == 'All' || job.category == _category) &&
        text.contains(_query.toLowerCase());
  }).toList();

  @override
  Widget build(BuildContext context) {
    final visibleJobs = _visibleJobs;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 22, 20, 28),
      children: [
        const Text(
          'BROWSE JOBS',
          style: TextStyle(
            color: _brand,
            fontSize: 10,
            fontWeight: FontWeight.w800,
            letterSpacing: 1.5,
          ),
        ),
        const SizedBox(height: 7),
        const Text(
          'Find the right gig for today',
          style: TextStyle(
            color: Color(0xFF102A43),
            fontSize: 28,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 5),
        const Text(
          'Explore short-term, part-time, and flexible jobs across Malaysia. Filter by category, location, and schedule.',
          style: TextStyle(color: Color(0xFF64748B), fontSize: 14),
        ),
        const SizedBox(height: 19),
        TextField(
          onChanged: (value) => setState(() => _query = value.trim()),
          textInputAction: TextInputAction.search,
          decoration: InputDecoration(
            hintText: 'Search by role, location, or keyword',
            hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
            prefixIcon: const Icon(Icons.search, color: Color(0xFF64748B)),
            filled: true,
            fillColor: Colors.white,
            contentPadding: const EdgeInsets.symmetric(vertical: 14),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(15),
              borderSide: const BorderSide(color: Color(0xFFCFEFF6)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(15),
              borderSide: const BorderSide(color: Color(0xFFCFEFF6)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(15),
              borderSide: const BorderSide(color: _brand),
            ),
          ),
        ),
        const SizedBox(height: 15),
        SizedBox(
          height: 38,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: jobCategories.map((category) {
              final selected = _category == category;
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(
                  label: Text(category),
                  selected: selected,
                  onSelected: (_) => setState(() => _category = category),
                  showCheckmark: false,
                  labelStyle: TextStyle(
                    color: selected ? Colors.white : const Color(0xFF0E7490),
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                  backgroundColor: const Color(0xFFE5F6FA),
                  selectedColor: _brand,
                  side: BorderSide(
                    color: selected
                        ? _brand
                        : const Color(0xFFA5F3FC),
                  ),
                  shape: const StadiumBorder(),
                  padding: const EdgeInsets.symmetric(horizontal: 7),
                ),
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 15),
        Row(
          children: [
            Text(
              '${visibleJobs.length} opportunities',
              style: const TextStyle(
                color: Color(0xFF102A43),
                fontSize: 15,
                fontWeight: FontWeight.w800,
              ),
            ),
            const Spacer(),
            const _DemoBadge(),
          ],
        ),
        const SizedBox(height: 12),
        if (visibleJobs.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 42),
            child: Text(
              'No sample jobs match. Try another search or category.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(0xFF64748B)),
            ),
          )
        else
          ...visibleJobs.map(
            (job) => JobCard(
              job: job,
              isSaved: widget.savedJobIds.contains(job.id),
              onSave: () => widget.onSave(job.id),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => JobDetailsScreen(job: job),
                ),
              ),
            ),
          ),
        const SizedBox(height: 4),
        const Text(
          'These are sample listings, not live vacancies. Location services and live job data are not connected.',
          textAlign: TextAlign.center,
          style: TextStyle(color: Color(0xFF8291A2), fontSize: 11, height: 1.5),
        ),
      ],
    );
  }
}

class _DemoBadge extends StatelessWidget {
  const _DemoBadge();

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
    decoration: BoxDecoration(
      color: const Color(0xFFFFF2D9),
      borderRadius: BorderRadius.circular(8),
    ),
    child: const Text(
      'DEMO PREVIEW',
      style: TextStyle(
        color: Color(0xFF9A5D0B),
        fontSize: 9,
        fontWeight: FontWeight.w800,
        letterSpacing: .5,
      ),
    ),
  );
}
