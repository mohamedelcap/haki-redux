import { Email } from "@convex-dev/auth/providers/Email";
import axios from "axios";

/**
 * Email delivery for password-reset codes. Mirrors emailOtp.ts but with
 * reset-specific copy so users can tell the two emails apart.
 */
export const resetEmail = Email({
  id: "reset-email",
  maxAge: 60 * 15, // 15 minutes
  async generateVerificationToken() {
    const random: import("@oslojs/crypto/random").RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    const alphabet = "0123456789";
    return generateRandomString(random, alphabet, 6);
  },
  async sendVerificationRequest({ identifier: email, token }) {
    try {
      await axios.post(
        "https://auth.freebuff.app/send_otp",
        {
          to: email,
          otp: token,
          appName: `${process.env.VLY_APP_NAME || "a freebuff.com application"} — استعادة كلمة المرور`,
        },
        {
          headers: {
            "x-api-key": "fb_email_2crN1hqIArZP2bEfvjp5Qik4",
          },
        },
      );
    } catch (error) {
      throw new Error(JSON.stringify(error));
    }
  },
});

function generateRandomString(
  random: { read(bytes: Uint8Array): void },
  alphabet: string,
  length: number,
) {
  let result = "";
  const bytes = new Uint8Array(length);
  random.read(bytes);
  for (let i = 0; i < length; i++) {
    result += alphabet[bytes[i] % alphabet.length];
  }
  return result;
}
