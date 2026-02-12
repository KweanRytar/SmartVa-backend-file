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
      const username = email.split("@")[0];
  let name = username;

  // Make it look like a real name when possible
  if (username.includes('.')) {
    name = username
      .split('.')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  } else if (username.includes('-') || username.includes('_')) {
    name = username
      .split(/[-_]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  } else {
    name = username.charAt(0).toUpperCase() + username.slice(1).toLowerCase();
  }

  result.push({
    name: name || "External Delegate",
    email,
  });
    }
  }

  return result;
};
