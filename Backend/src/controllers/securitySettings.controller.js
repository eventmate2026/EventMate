import {
  getSecuritySettings,
  invalidateAllSessions,
  toSecuritySettingsDto,
  updateSecuritySettings,
} from "../services/securitySettings.service.js";

const clampNumber = (value, min, max) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  return Math.min(max, Math.max(min, numeric));
};

const buildUpdates = (payload) => {
  const updates = {};

  if (payload?.maxFailedLoginAttempts !== undefined) {
    const next = clampNumber(payload.maxFailedLoginAttempts, 3, 20);
    if (next !== undefined) updates.maxFailedLoginAttempts = next;
  }

  if (payload?.lockoutDurationMinutes !== undefined) {
    const next = clampNumber(payload.lockoutDurationMinutes, 5, 240);
    if (next !== undefined) updates.lockoutDurationMinutes = next;
  }

  if (payload?.accessTokenLifetimeMinutes !== undefined) {
    const next = clampNumber(payload.accessTokenLifetimeMinutes, 5, 120);
    if (next !== undefined) updates.accessTokenLifetimeMinutes = next;
  }

  if (payload?.refreshTokenLifetimeDays !== undefined) {
    const next = clampNumber(payload.refreshTokenLifetimeDays, 1, 30);
    if (next !== undefined) updates.refreshTokenLifetimeDays = next;
  }

  if (payload?.notifyOnLockout !== undefined) {
    updates.notifyOnLockout = Boolean(payload.notifyOnLockout);
  }

  if (payload?.maintenanceMode !== undefined) {
    updates.maintenanceMode = Boolean(payload.maintenanceMode);
  }

  return updates;
};

export const getSecuritySettingsController = async (req, res, next) => {
  try {
    const settings = await getSecuritySettings();
    return res.status(200).json({
      success: true,
      data: toSecuritySettingsDto(settings),
    });
  } catch (error) {
    next(error);
  }
};

export const updateSecuritySettingsController = async (req, res, next) => {
  try {
    const updates = buildUpdates(req.body || {});
    const settings = await updateSecuritySettings(updates, req.user?._id || null);
    return res.status(200).json({
      success: true,
      message: "Security settings updated.",
      data: toSecuritySettingsDto(settings),
    });
  } catch (error) {
    next(error);
  }
};

export const rotateSecuritySecretController = async (req, res, next) => {
  try {
    const settings = await invalidateAllSessions(req.user?._id || null, { rotate: true });
    return res.status(200).json({
      success: true,
      message: "Security rotation applied. All sessions require fresh login.",
      data: toSecuritySettingsDto(settings),
    });
  } catch (error) {
    next(error);
  }
};

export const forceLogoutAllController = async (req, res, next) => {
  try {
    const settings = await invalidateAllSessions(req.user?._id || null);
    return res.status(200).json({
      success: true,
      message: "Forced logout applied to all sessions.",
      data: toSecuritySettingsDto(settings),
    });
  } catch (error) {
    next(error);
  }
};
