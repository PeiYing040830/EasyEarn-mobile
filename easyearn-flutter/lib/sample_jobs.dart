import 'job_listing.dart';

// Local preview data only. These are not live EasyEarn vacancies.
const sampleJobs = <JobListing>[
  JobListing(
    id: 'preview-event-crew',
    title: 'Weekend Event Crew',
    employerName: 'Community Events',
    location: 'Kuala Lumpur',
    category: 'Events',
    jobType: 'Part-time',
    payRate: '15',
    payType: 'hour',
    description:
        'Help welcome guests, prepare event areas, and support the event team during a weekend community event.',
  ),
  JobListing(
    id: 'preview-cafe-crew',
    title: 'Cafe Service Crew',
    employerName: 'Neighbourhood Cafe',
    location: 'Petaling Jaya',
    category: 'F&B',
    jobType: 'Flexible',
    payRate: '12',
    payType: 'hour',
    description:
        'Assist with customer service and daily cafe operations. Flexible shifts are available in this sample listing.',
  ),
  JobListing(
    id: 'preview-english-tutor',
    title: 'Primary English Tutor',
    employerName: 'Learning Circle',
    location: 'Shah Alam',
    category: 'Education',
    jobType: 'Part-time',
    payRate: '35',
    payType: 'hour',
    description:
        'Support primary school learners with English reading and practice in a small-group setting.',
  ),
  JobListing(
    id: 'preview-delivery-partner',
    title: 'Local Delivery Partner',
    employerName: 'City Parcel Co.',
    location: 'Subang Jaya',
    category: 'Delivery',
    jobType: 'Flexible',
    payRate: '10',
    payType: 'delivery',
    description:
        'Deliver small parcels within a local service area. This preview does not represent a verified employer or vacancy.',
  ),
];

const jobCategories = <String>['All', 'Events', 'F&B', 'Education', 'Delivery'];
