import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const secretKey = new TextEncoder().encode(
  process.env.JWT_SECRET_KEY || "qwi-booking-super-secret-default-key"
);

export async function decrypt(token) {
  try {
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });
    return payload;
  } catch (error) {
    return null;
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  const sessionCookie = (await cookieStore).get("session")?.value;

  if (!sessionCookie) return null;
  return await decrypt(sessionCookie);
}