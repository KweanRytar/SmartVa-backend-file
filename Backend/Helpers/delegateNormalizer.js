import { User } from "../model/user.model.js";

export const normalizeDelegates = async (delegates) => {
  if (!delegates) return [];

  const list = Array.isArray(delegates) ? delegates : [delegates];
  const result = [];

  for (const d of list) {
    // Allow frontend to send string email or object
    const email =
      typeof d === "string"
        ? d.toLowerCase()
        : d?.email?.toLowerCase();

    if (!email) {
      throw Object.assign(new Error("Invalid delegate format"), {
        statusCode: 400,
      });
    }

    // Check if SmartVA user exists
    const user = await User.findOne({ email });

    if (user) {
      // Existing SmartVA user
      result.push({
        userId: user._id,
        name: user.fullName,
        email: user.email,
      });
    } else {
      // External delegate (email only)
      result.push({
        name: email.split("@")[0],
        email,
      });
    }
  }

  return result;
};
