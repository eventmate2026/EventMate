const normalizeText = (value) => String(value || "").trim();

export const computeProfileProgress = (user) => {
  if (!user) {
    return { percent: 0, left: 0, total: 0, done: 0 };
  }

  const role = normalizeText(user.role).toUpperCase();
  const checks = [
    normalizeText(user.fullName || user.name),
    normalizeText(user.email),
    normalizeText(user.mobileNumber || user.phone || user.phoneNumber),
    normalizeText(user.avatar),
    normalizeText(user.educationLevel),
  ];

  if (role === "STUDENT") {
    checks.push(normalizeText(user.collegeName));
    checks.push(normalizeText(user.academicProfile?.branch));
    const educationLevel = normalizeText(user.educationLevel);
    if (educationLevel !== "10th" && educationLevel !== "12th") {
      checks.push(normalizeText(user.academicProfile?.year));
    }
  } else {
    checks.push(
      normalizeText(user.professionalProfile?.department || user.academicProfile?.branch)
    );
  }

  const done = checks.filter((value) => value.length > 0).length;
  const total = checks.length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  const left = Math.max(0, total - done);

  return { percent, left, total, done };
};
