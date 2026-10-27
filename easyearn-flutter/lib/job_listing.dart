class JobListing {
  const JobListing({
    required this.id,
    required this.title,
    required this.location,
    required this.category,
    required this.jobType,
    required this.payRate,
    required this.payType,
    required this.description,
    required this.employerName,
  });

  final String id;
  final String title;
  final String location;
  final String category;
  final String jobType;
  final String payRate;
  final String payType;
  final String description;
  final String employerName;

  String get payLabel =>
      payRate.isEmpty ? 'Negotiable' : 'RM $payRate / $payType';
}
