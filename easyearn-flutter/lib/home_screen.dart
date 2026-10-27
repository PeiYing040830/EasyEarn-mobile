import 'dart:async';

import 'package:flutter/material.dart';

import 'job_card.dart';
import 'job_details_screen.dart';
import 'sample_jobs.dart';

const _brand = Color(0xFF0891B2);
const _brandDark = Color(0xFF0E7490);
const _ink = Color(0xFF0F172A);
const _muted = Color(0xFF475569);
const _page = Color(0xFFEEF9FC);

class HomeScreen extends StatefulWidget {
  const HomeScreen({
    super.key,
    required this.savedJobIds,
    required this.onSave,
    required this.onBrowse,
  });

  final Set<String> savedJobIds;
  final ValueChanged<String> onSave;
  final ValueChanged<String> onBrowse;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  static const _slides = <String>[
    'assets/images/barista.png',
    'assets/images/grab.jpg',
    'assets/images/tutor.jpeg',
    'assets/images/eventcrew.jpeg',
  ];
  static const _features = <({String icon, String title, String body})>[
    (icon: '✅', title: 'Verified Employers', body: 'Every employer gets a verification badge. No more job scams from Facebook groups.'),
    (icon: '📄', title: 'Auto Resume', body: 'Your work history automatically generates a downloadable PDF resume.'),
    (icon: '📍', title: 'Location Filter', body: 'Find jobs near you — even in smaller towns across Malaysia.'),
    (icon: '⭐', title: 'Rating System', body: 'Both job seekers and employers rate each other for a trusted community.'),
    (icon: '🌐', title: 'Multilingual', body: 'Available in Bahasa Malaysia, English, Mandarin and Tamil via Google Translate.'),
    (icon: '🤖', title: '24/7 Chatbot', body: 'Get help anytime with our rule-based chatbot support system.'),
  ];
  static const _roles = <({String icon, String title, List<String> items, String button})>[
    (icon: '🔍', title: 'Job Seekers', items: ['University students', 'Housewives', 'Unemployed individuals', 'Anyone needing flexible income'], button: 'Join as Job Seeker'),
    (icon: '🏢', title: 'Employers', items: ['Small & medium businesses', 'Event organisers', 'F&B outlets', 'Individual hirers'], button: 'Join as Employer'),
  ];

  int _slideIndex = 0;
  Timer? _slideTimer;

  @override
  void initState() {
    super.initState();
    _slideTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (mounted) setState(() => _slideIndex = (_slideIndex + 1) % _slides.length);
    });
  }

  @override
  void dispose() {
    _slideTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: _page,
      child: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(child: _navbar(context)),
          SliverToBoxAdapter(child: _hero(context)),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(12, 16, 12, 24),
            sliver: SliverList.list(children: [
              _featureSection(),
              const SizedBox(height: 12),
              _browseSection(context),
              const SizedBox(height: 12),
              _rolesSection(context),
              const SizedBox(height: 12),
              _jobsSection(context),
              const SizedBox(height: 20),
              const Center(child: Text('EasyEarn • Job Matching Portal', style: TextStyle(color: Color(0xFF64748B), fontSize: 12))),
              const SizedBox(height: 14),
            ]),
          ),
        ],
      ),
    );
  }

  Widget _navbar(BuildContext context) {
    return Container(
      height: 70,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      decoration: const BoxDecoration(color: Color(0xFFF8FDFF), boxShadow: [BoxShadow(color: Color(0x14000000), blurRadius: 3, offset: Offset(0, 1))]),
      child: Row(children: [
        Image.asset('assets/images/logo.png', width: 39, height: 39, fit: BoxFit.contain),
        const SizedBox(width: 9),
        const Text('EasyEarn', style: TextStyle(color: _brand, fontSize: 21, fontWeight: FontWeight.w800)),
        const Spacer(),
        IconButton(onPressed: () => widget.onBrowse('All'), icon: const Icon(Icons.search, color: _ink), tooltip: 'Browse Jobs'),
        IconButton(
          onPressed: () => showModalBottomSheet<void>(
            context: context,
            backgroundColor: const Color(0xFFF8FDFF),
            builder: (context) => SafeArea(child: Column(mainAxisSize: MainAxisSize.min, children: [
              const SizedBox(height: 8),
              for (final item in const [('Home', Icons.home_outlined), ('About', Icons.info_outline), ('Help', Icons.help_outline), ('Browse Jobs', Icons.search), ('Report', Icons.flag_outlined), ('Security', Icons.shield_outlined), ('Login', Icons.login), ('Get Started', Icons.person_add_alt_1)])
                ListTile(leading: Icon(item.$2, color: _brandDark), title: Text(item.$1, style: const TextStyle(color: _ink)), onTap: () { Navigator.pop(context); if (item.$1 == 'Browse Jobs') widget.onBrowse('All'); else if (item.$1 == 'Get Started' || item.$1 == 'Login') _showNotice(context, 'Account setup will be connected in a later step.'); }),
              const SizedBox(height: 8),
            ])),
          ),
          icon: const Icon(Icons.menu, color: _ink),
          tooltip: 'Open menu',
        ),
      ]),
    );
  }

  Widget _hero(BuildContext context) {
    return SizedBox(
      height: MediaQuery.sizeOf(context).height < 770
          ? 620
          : MediaQuery.sizeOf(context).height - 150,
      child: Stack(fit: StackFit.expand, children: [
        for (var i = 0; i < _slides.length; i++)
          AnimatedOpacity(
            key: ValueKey(_slides[i]),
            opacity: i == _slideIndex ? 1 : 0,
            duration: const Duration(milliseconds: 900),
            child: Image.asset(_slides[i], fit: BoxFit.cover, alignment: Alignment.center),
          ),
        const DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0x8C0F172A), Color(0x4D0F172A)]))),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 26, vertical: 28),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Container(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8), decoration: BoxDecoration(color: const Color(0x2E0891B2), borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0x590891B2))), child: const Text('EasyEarn Job Matching Portal', textAlign: TextAlign.center, style: TextStyle(color: Color(0xFFA5F3FC), fontSize: 12, fontWeight: FontWeight.w600, letterSpacing: .3))),
            const SizedBox(height: 24),
            const Text.rich(TextSpan(style: TextStyle(fontSize: 36, height: 1.15, fontWeight: FontWeight.w800, color: Color(0xFFF8FAFC)), children: [TextSpan(text: 'Find Jobs.\nHire Talent.\n'), TextSpan(text: 'EasyEarn.', style: TextStyle(color: _brand, shadows: [Shadow(color: Colors.black54, blurRadius: 12, offset: Offset(0, 2))]))]), textAlign: TextAlign.center),
            const SizedBox(height: 18),
            const Text('Work your way, earn your day. Connecting job seekers and employers across Malaysia — for every city, every role, and every schedule.', textAlign: TextAlign.center, style: TextStyle(color: Color(0xD1F8FAFC), fontSize: 15, height: 1.65)),
            const SizedBox(height: 25),
            Wrap(alignment: WrapAlignment.center, spacing: 10, runSpacing: 10, children: [
              FilledButton.icon(onPressed: () => widget.onBrowse('All'), style: FilledButton.styleFrom(backgroundColor: _brand, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))), icon: const Icon(Icons.search, size: 18), label: const Text('Find a Job', style: TextStyle(fontWeight: FontWeight.w700))),
              OutlinedButton.icon(onPressed: () => _showNotice(context, 'Employer sign-up will be connected in a later step.'), style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Color(0x8CFFFFFF), width: 1.5), padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))), icon: const Icon(Icons.business_outlined, size: 18), label: const Text('Post a Job', style: TextStyle(fontWeight: FontWeight.w700))),
            ]),
            const SizedBox(height: 34),
            Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: const [
              _HeroStat(number: 'New', label: 'Early Access\nPlatform'),
              _HeroStat(number: '100%', label: 'Verified\nEmployers'),
              _HeroStat(number: 'Free', label: 'To Join'),
            ]),
          ]),
        ),
        Positioned(
          bottom: 13,
          left: 0,
          right: 0,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(
              _slides.length,
              (i) => AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: i == _slideIndex ? 18 : 6,
                height: 6,
                decoration: BoxDecoration(
                  color: i == _slideIndex ? Colors.white : Colors.white54,
                  borderRadius: BorderRadius.circular(5),
                ),
              ),
            ),
          ),
        ),
      ]),
    );
  }

  Widget _featureSection() => _section(
    title: 'Why EasyEarn?', subtitle: "Built for Malaysia's growing gig economy",
    child: Column(children: _features.map((feature) => Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: const Color(0xFFF8FDFF), borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFCFEFF6)), boxShadow: const [BoxShadow(color: Color(0x140E7490), blurRadius: 18, offset: Offset(0, 5))]),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(width: 48, height: 48, alignment: Alignment.center, decoration: BoxDecoration(color: const Color(0xFFCFFAFE), borderRadius: BorderRadius.circular(14)), child: Text(feature.icon, style: const TextStyle(fontSize: 22))),
        const SizedBox(height: 14),
        Text(feature.title, style: const TextStyle(color: _ink, fontWeight: FontWeight.w700, fontSize: 17)),
        const SizedBox(height: 8),
        Text(feature.body, style: const TextStyle(color: _muted, fontSize: 14, height: 1.65)),
      ]),
    )).toList()),
  );

  Widget _browseSection(BuildContext context) => _section(
    title: 'Browse Jobs', subtitle: 'Explore short-term and part-time opportunities across Malaysia.',
    child: Center(child: FilledButton(onPressed: () => widget.onBrowse('All'), style: FilledButton.styleFrom(backgroundColor: _brand, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))), child: const Text('Browse Jobs', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)))),
  );

  Widget _rolesSection(BuildContext context) => _section(
    title: 'Who We Serve', subtitle: "EasyEarn is built for everyone in Malaysia's gig economy",
    child: Column(children: _roles.map((role) => Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.fromLTRB(22, 26, 22, 22),
      decoration: BoxDecoration(color: const Color(0xFFF8FDFF), border: Border.all(color: _brand, width: 1.5), borderRadius: BorderRadius.circular(20), boxShadow: const [BoxShadow(color: Color(0x260891B2), blurRadius: 22, offset: Offset(0, 7))]),
      child: Column(children: [
        Text(role.icon, style: const TextStyle(fontSize: 42)),
        const SizedBox(height: 9),
        Text(role.title, style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w800, color: _ink)),
        const SizedBox(height: 12),
        ...role.items.map((item) => Padding(padding: const EdgeInsets.symmetric(vertical: 7), child: Row(children: [const Icon(Icons.check, color: _brand, size: 18), const SizedBox(width: 8), Expanded(child: Text(item, style: const TextStyle(fontSize: 14, color: _muted)))]))),
        const SizedBox(height: 16),
        SizedBox(width: double.infinity, child: FilledButton(onPressed: () => _showNotice(context, 'Account setup will be connected in a later step.'), style: FilledButton.styleFrom(backgroundColor: _brand, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 13), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))), child: Text(role.button, style: const TextStyle(fontWeight: FontWeight.w700)))),
      ]),
    )).toList()),
  );

  Widget _jobsSection(BuildContext context) => _section(
    title: 'Jobs to Explore', subtitle: 'Preview listings',
    child: Column(children: [
      ...sampleJobs.take(3).map((job) => JobCard(job: job, isSaved: widget.savedJobIds.contains(job.id), onSave: () => widget.onSave(job.id), onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => JobDetailsScreen(job: job))))),
      const SizedBox(height: 4),
      const Text('Sample listings for preview only — live vacancies will be connected in a later step.', textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF8291A2), fontSize: 11, height: 1.5)),
    ]),
  );

  Widget _section({required String title, required String subtitle, required Widget child}) => Container(
    width: double.infinity,
    padding: const EdgeInsets.fromLTRB(16, 26, 16, 24),
    decoration: BoxDecoration(color: Colors.white, border: Border.all(color: const Color(0xFFCFEFF6)), borderRadius: BorderRadius.circular(14), boxShadow: const [BoxShadow(color: Color(0x140891B2), blurRadius: 18, offset: Offset(0, 4))]),
    child: Column(children: [
      Text(title, textAlign: TextAlign.center, style: const TextStyle(color: _ink, fontSize: 25, fontWeight: FontWeight.w800)),
      const SizedBox(height: 8),
      Text(subtitle, textAlign: TextAlign.center, style: const TextStyle(color: _muted, fontSize: 14, height: 1.5)),
      const SizedBox(height: 24),
      child,
    ]),
  );

  void _showNotice(BuildContext context, String message) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message), duration: const Duration(seconds: 2)));
}

class _HeroStat extends StatelessWidget {
  const _HeroStat({required this.number, required this.label});
  final String number;
  final String label;

  @override
  Widget build(BuildContext context) => Expanded(child: Column(children: [
    Text(number, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800)),
    const SizedBox(height: 4),
    Text(label, textAlign: TextAlign.center, style: const TextStyle(color: Color(0xBFF8FAFC), fontSize: 10, height: 1.35)),
  ]));
}
