import 'package:flutter/material.dart';

import 'job_listing.dart';

class JobCard extends StatelessWidget {
  const JobCard({
    super.key,
    required this.job,
    required this.isSaved,
    required this.onSave,
    required this.onTap,
  });

  final JobListing job;
  final bool isSaved;
  final VoidCallback onSave;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      color: Colors.white,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: const BorderSide(color: Color(0xFFE5EDF3)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: const Color(0xFFE2F5F5),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Center(
                      child: Text(
                        _initials(job.employerName),
                        style: const TextStyle(
                          color: Color(0xFF087F8C),
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          job.title,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF17364B),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          job.employerName,
                          style: const TextStyle(
                            color: Color(0xFF718096),
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: isSaved ? 'Remove saved job' : 'Save job',
                    onPressed: onSave,
                    visualDensity: VisualDensity.compact,
                    icon: Icon(
                      isSaved ? Icons.bookmark : Icons.bookmark_border,
                      color: isSaved
                          ? const Color(0xFF07849A)
                          : const Color(0xFF8291A2),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 15),
              Wrap(
                spacing: 14,
                runSpacing: 8,
                children: [
                  _Meta(icon: Icons.location_on_outlined, label: job.location),
                  _Meta(icon: Icons.schedule_outlined, label: job.jobType),
                ],
              ),
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: Divider(height: 1, color: Color(0xFFEDF1F5)),
              ),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      job.payLabel,
                      style: const TextStyle(
                        color: Color(0xFF087F8C),
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                      ),
                    ),
                  ),
                  _Pill(label: job.category),
                  const SizedBox(width: 7),
                  const _Pill(label: 'SAMPLE', warm: true),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _initials(String name) => name
      .split(' ')
      .where((part) => part.isNotEmpty)
      .take(2)
      .map((part) => part[0])
      .join()
      .toUpperCase();
}

class _Meta extends StatelessWidget {
  const _Meta({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(icon, size: 15, color: const Color(0xFF718096)),
      const SizedBox(width: 4),
      Text(
        label,
        style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
      ),
    ],
  );
}

class _Pill extends StatelessWidget {
  const _Pill({required this.label, this.warm = false});
  final String label;
  final bool warm;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
    decoration: BoxDecoration(
      color: warm ? const Color(0xFFFFF2D9) : const Color(0xFFF1F5F9),
      borderRadius: BorderRadius.circular(8),
    ),
    child: Text(
      label,
      style: TextStyle(
        color: warm ? const Color(0xFF9A5D0B) : const Color(0xFF526579),
        fontWeight: FontWeight.w700,
        fontSize: 9,
        letterSpacing: warm ? .5 : 0,
      ),
    ),
  );
}
