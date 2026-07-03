import type { Check, DerivedCheck } from "../types";
import { javaVersionRegex, requiresJavaRegex, unsupportedJavaRegex } from "../regexes";
import { stripPrefix } from "./util";

const MAX_VM_WARNINGS = 5;

// "1.8.0_312" uses the legacy 1.x scheme (major = 8); "17.0.9" is the modern scheme (major = 17).
export function normalizeJavaMajor(version: string): number | null {
  const parts = version.split(/[._]/).map((p) => Number.parseInt(p, 10));
  if (Number.isNaN(parts[0])) return null;
  if (parts[0] === 1) return Number.isNaN(parts[1]) ? null : parts[1];
  return parts[0];
}

// Minimum Java major per MC version. 26.x is the YY.D.H scheme (2026+); the 1.20.5 cutoff is when
// Mojang moved to Java 21.
export function requiredJavaFor(mcVersion: string): number | null {
  const parts = mcVersion.split(".").map((p) => Number.parseInt(p, 10));
  const [major, minor = 0, patch = 0] = parts;
  if (Number.isNaN(major)) return null;
  if (major >= 26) return 25;
  if (major !== 1) return null;
  if (Number.isNaN(minor)) return null;
  if (minor >= 21) return 21;
  if (minor === 20) return patch >= 5 ? 21 : 17;
  if (minor >= 18) return 17;
  if (minor === 17) return 16;
  return 8;
}

export const javaCheck: Check = {
  id: "java",
  prefilter: ["Unsupported Java detected", "Java version", "Java Version", "OpenJDK 64-Bit Server VM warning", "requires running the server with Java", "requires at least Java"],
  onLine(line, _index, ctx) {
    const { javaEnv } = ctx.findings;
    // "Unsupported Java detected (61.0). Only up to Java 16 is supported." — the paren holds the
    // class-file major (major - 44 = Java major); the tail is an upper bound on this build.
    const unsupported = unsupportedJavaRegex.exec(line);
    if (unsupported !== null) {
      const classfileMajor = Number.parseInt(unsupported[1], 10);
      if (classfileMajor >= 45) javaEnv.javaMajor = classfileMajor - 44;
      if (unsupported[2] !== undefined) {
        javaEnv.maxSupportedJavaMajor = Number.parseInt(unsupported[2], 10);
      }
      // Fall through: the same banner can carry a "requires at least Java N" statement.
    }
    // The log's own minimum statement is authoritative for this build; it beats the version table.
    const requires = requiresJavaRegex.exec(line);
    if (requires !== null) {
      javaEnv.requiredJavaMajor = Number.parseInt(requires[1], 10);
      return;
    }
    if (unsupported !== null) return;
    if (line.includes("OpenJDK 64-Bit Server VM warning")) {
      if (javaEnv.vmWarnings.length < MAX_VM_WARNINGS) javaEnv.vmWarnings.push(stripPrefix(line));
      return;
    }
    const version = javaVersionRegex.exec(line);
    if (version !== null && javaEnv.javaVersion === null) {
      javaEnv.javaVersion = version[1];
      javaEnv.javaMajor = normalizeJavaMajor(version[1]);
    }
  },
};

// Registered after resolveVersion so mcVersion is populated. A "requires Java N" statement captured
// from the log wins over the table.
export const resolveRequiredJava: DerivedCheck = {
  id: "resolve-required-java",
  run(ctx) {
    const { javaEnv, mcVersion } = ctx.findings;
    if (javaEnv.requiredJavaMajor !== null || mcVersion === null) return;
    javaEnv.requiredJavaMajor = requiredJavaFor(mcVersion);
  },
};
