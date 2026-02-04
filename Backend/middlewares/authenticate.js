// middleware/authenticate.js
import jwt from "jsonwebtoken";


export const authenticate = (req, res, next) => {
  try {
    // Get token from cookies or Authorization header
    const token =
      req.cookies?.token || req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res
        .status(401)
        .json({ message: "Unauthorized - No token provided" });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.jwtSecret);

    // Attach to req.user
    req.user = {
      userId: decoded.userId,
      // add more if needed later, e.g. role: decoded.role
    };

    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res
      .status(403)
      .json({ message: "Unauthorized - Invalid or expired token" });
  }
};
