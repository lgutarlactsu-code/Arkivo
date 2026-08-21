export const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    draft: 'Draft',
    submitted: 'Submitted',
    approved: 'Approved',
    rejected: 'Rejected',
    archived: 'Archived',
  };
  return labels[status] || status;
};

export const getRoleLabel = (role: string) => {
  const labels: Record<string, string> = {
    super_admin: 'Super Admin',
    lgu_head: 'LGU Head',
    dept_admin: 'Department Admin',
    records_officer: 'Records Officer',
    staff: 'Staff',
    public: 'Public User',
  };
  return labels[role] || role;
};

export const getDepartmentLabel = (department: string) => {
  const labels: Record<string, string> = {
    administration: 'Administration',
    finance: 'Finance',
    engineering: 'Engineering',
    health: 'Health',
    social_welfare: 'Social Welfare',
    agriculture: 'Agriculture',
    education: 'Education',
    planning: 'Planning & Development',
  };
  return labels[department] || department;
};

export const getAccessLevelLabel = (level: string) => {
  const labels: Record<string, string> = {
    public: 'Public',
    restricted: 'Restricted',
    confidential: 'Confidential',
    highly_confidential: 'Highly Confidential',
  };
  return labels[level] || level;
};

export const canUserApprove = (userRole: string) => {
  return ['super_admin', 'lgu_head', 'dept_admin'].includes(userRole);
};

export const canUserManageUsers = (userRole: string) => {
  return ['super_admin', 'lgu_head', 'dept_admin'].includes(userRole);
};

export const canUserViewAuditLogs = (userRole: string) => {
  return ['super_admin', 'lgu_head'].includes(userRole);
};

export const truncateText = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const getInitials = (name: string) => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
};
