export const resolveUserDepartment = (user) => {
  const candidates = [
    user?.professionalProfile?.department,
    user?.academicProfile?.branch,
    user?.academicProfile?.department,
    user?.department,
    user?.branch,
  ];

  for (const value of candidates) {
    const trimmed = String(value || "").trim();
    if (trimmed) return trimmed;
  }

  return "";
};
