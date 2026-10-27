// Platform review requirements, shared by submission and admin approval.
export function normalizeEmployerType(value) {
  if (['Individual Hirer', 'Freelancer / Individual Employer'].includes(value)) return 'Individual Hirer';
  if (['Online Seller / E-commerce', 'Online Business / E-commerce'].includes(value)) return 'Online Seller / E-commerce';
  if (['Company / Business', 'Sole Proprietorship', 'Partnership', 'Enterprise',
    'Private Limited Company (Sdn. Bhd.)', 'Public Limited Company (Berhad)',
    'Limited Liability Partnership (LLP)', 'Non-Profit / NGO', 'Other'].includes(value)) return 'Company / Business';
  return '';
}

export function verificationRequirements(businessType) {
  const employerType = normalizeEmployerType(businessType);
  const individual = employerType === 'Individual Hirer';
  return {
    employerType,
    individual,
    requiresRegistrationNumber: !individual,
    registrationLabel: individual ? 'Proof of address' : 'Business / organisation registration document',
    contactLabel: individual ? 'Identity proof' : 'Contact person proof',
    addressLabel: individual ? 'Contact address' : 'Registered business / organisation address'
  };
}

export function verificationPackageError(payload) {
  if (!normalizeEmployerType(payload.businessType)) return 'Please select a valid employer type.';
  const rules = verificationRequirements(payload.businessType);
  if (rules.requiresRegistrationNumber && String(payload.ssmNumber || '').trim().length < 6) {
    return 'Please enter a valid registration number (at least 6 characters).';
  }
  if (String(payload.businessAddress || '').trim().length < 10) {
    return 'Please enter the full address (at least 10 characters).';
  }
  if (!payload.registration?.content || !payload.contact?.content) {
    return `Please upload ${rules.registrationLabel.toLowerCase()} and ${rules.contactLabel.toLowerCase()}.`;
  }
  return '';
}
