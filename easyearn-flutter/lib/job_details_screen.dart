import 'package:flutter/material.dart';

import 'job_listing.dart';

class JobDetailsScreen extends StatelessWidget {
  const JobDetailsScreen({super.key, required this.job});
  final JobListing job;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F8FC),
      appBar: AppBar(
        title: const Text(
          'Job details',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: const Color(0xFF073B4C),
              borderRadius: BorderRadius.circular(22),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 9,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0B5661),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    job.category.toUpperCase(),
                    style: const TextStyle(
                      color: Color(0xFF8BE2D4),
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      letterSpacing: .7,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  job.title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 25,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  job.employerName,
                  style: const TextStyle(
                    color: Color(0xFFC2D8DF),
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 18),
                const Text(
                  'SAMPLE LISTING • NOT A LIVE VACANCY',
                  style: TextStyle(
                    color: Color(0xFFFFD790),
                    fontWeight: FontWeight.w700,
                    fontSize: 10,
                    letterSpacing: .5,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _InfoTile(
            icon: Icons.payments_outlined,
            title: 'Pay',
            value: job.payLabel,
          ),
          _InfoTile(
            icon: Icons.location_on_outlined,
            title: 'Location',
            value: job.location,
          ),
          _InfoTile(
            icon: Icons.schedule_outlined,
            title: 'Schedule',
            value: job.jobType,
          ),
          const SizedBox(height: 10),
          const Text(
            'About this role',
            style: TextStyle(
              color: Color(0xFF17364B),
              fontWeight: FontWeight.w800,
              fontSize: 18,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            job.description,
            style: const TextStyle(
              color: Color(0xFF526579),
              height: 1.55,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text(
                  'Applications will be available after account and backend setup.',
                ),
              ),
            ),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF07849A),
              padding: const EdgeInsets.symmetric(vertical: 15),
            ),
            child: const Text('Apply for this job'),
          ),
          const SizedBox(height: 8),
          const Text(
            'Application submission is not connected in this preview.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFF8291A2), fontSize: 11),
          ),
        ],
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  const _InfoTile({
    required this.icon,
    required this.title,
    required this.value,
  });
  final IconData icon;
  final String title;
  final String value;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 9),
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(15),
      border: Border.all(color: const Color(0xFFE6EDF3)),
    ),
    child: Row(
      children: [
        Icon(icon, color: const Color(0xFF07849A)),
        const SizedBox(width: 12),
        Expanded(
          child: Text(title, style: const TextStyle(color: Color(0xFF718096))),
        ),
        Text(
          value,
          style: const TextStyle(
            color: Color(0xFF17364B),
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    ),
  );
}
