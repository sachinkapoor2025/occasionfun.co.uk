import { Amplify } from "aws-amplify";
import {
  confirmResetPassword,
  confirmSignUp,
  fetchAuthSession,
  resetPassword,
  signIn,
  signOut,
  signUp,
  type SignInOutput,
} from "aws-amplify/auth";
import { cognitoUserPoolsTokenProvider } from "aws-amplify/auth/cognito";
import { createSessionKeyValueStorage } from "./session-storage";

const SIGN_IN_ERROR =
  "The email or password is incorrect, or this account cannot sign in.";
const AUTHENTICATOR_NOT_USED =
  "Sign-in uses email and password only. Authenticator verification is not used.";
const RESET_ERROR =
  "That code is not valid, or the new password does not meet the password policy.";
const CONFIG_ERROR =
  "Administrator sign-in is not configured for this environment.";
const SESSION_UNAVAILABLE =
  "The existing session could not be checked. Try again.";

/**
 * Names that @aws-amplify/auth 6.21.2 treats as a dead session in
 * TokenOrchestrator.isAuthenticationError. NotAuthorizedException comes
 * back as no tokens. The others are rethrown after the stored tokens are
 * cleared. Match the library's startsWith check.
 */
const DEFINITIVE_AUTH_FAILURES = [
  "NotAuthorizedException",
  "TokenRevokedException",
  "UserNotFoundException",
  "PasswordResetRequiredException",
  "UserNotConfirmedException",
  "RefreshTokenReuseException",
] as const;

const ALREADY_AUTHENTICATED = "UserAlreadyAuthenticatedException";

export class AuthConfigError extends Error {
  constructor() {
    super(CONFIG_ERROR);
    this.name = "AuthConfigError";
  }
}

export class AuthFlowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthFlowError";
  }
}

export type SessionStatus =
  | { status: "signed-in" }
  | { status: "unapproved" }
  | { status: "signed-out" }
  | { status: "unavailable" };

export type SignInStatus = SessionStatus | { status: "reset-password" };

const AUTHENTICATOR_STEPS = new Set([
  "CONFIRM_SIGN_IN_WITH_TOTP_CODE",
  "CONTINUE_SIGN_IN_WITH_TOTP_SETUP",
  "CONFIRM_SIGN_IN_WITH_SMS_CODE",
  "CONFIRM_SIGN_IN_WITH_EMAIL_CODE",
  "CONTINUE_SIGN_IN_WITH_EMAIL_SETUP",
  "CONTINUE_SIGN_IN_WITH_MFA_SELECTION",
  "CONTINUE_SIGN_IN_WITH_MFA_SETUP_SELECTION",
]);

let configured = false;
let refreshBlocked = false;
let sessionFlight: Promise<SessionStatus> | null = null;

export function isAuthConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_COGNITO_REGION &&
      process.env.NEXT_PUBLIC_COGNITO_POOL_ID &&
      process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
  );
}

export function ensureConfigured() {
  const region = process.env.NEXT_PUBLIC_COGNITO_REGION;
  const userPoolId = process.env.NEXT_PUBLIC_COGNITO_POOL_ID;
  const userPoolClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  if (!region || !userPoolId || !userPoolClientId) {
    throw new AuthConfigError();
  }
  if (configured) return;

  if (typeof window !== "undefined") {
    cognitoUserPoolsTokenProvider.setKeyValueStorage(
      createSessionKeyValueStorage(),
    );
  }

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
      },
    },
  });
  configured = true;
}

function groupsIncludeAdmin(payload: Record<string, unknown> | undefined) {
  const groups = payload?.["cognito:groups"];
  return Array.isArray(groups) && groups.includes("admin");
}

function errorName(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "name" in error &&
    typeof error.name === "string"
  ) {
    return error.name;
  }
  return "";
}

function isDefinitiveAuthFailure(error: unknown) {
  const name = errorName(error);
  return DEFINITIVE_AUTH_FAILURES.some((code) => name.startsWith(code));
}

function isAlreadyAuthenticated(error: unknown) {
  return errorName(error) === ALREADY_AUTHENTICATED;
}

function signOutState(): SessionStatus {
  refreshBlocked = true;
  return { status: "signed-out" };
}

async function readSession(): Promise<SessionStatus> {
  ensureConfigured();
  try {
    const session = await fetchAuthSession();
    const accessToken = session.tokens?.accessToken;
    if (!accessToken) {
      // Amplify returns no tokens when nothing is stored and when
      // NotAuthorizedException has already cleared the refresh token.
      return signOutState();
    }
    refreshBlocked = false;
    if (!groupsIncludeAdmin(accessToken.payload)) {
      return { status: "unapproved" };
    }
    return { status: "signed-in" };
  } catch (error) {
    if (isDefinitiveAuthFailure(error)) {
      return signOutState();
    }
    // Network, timeout, throttling, and other service errors leave the
    // stored refresh token alone. The next explicit read can try again.
    return { status: "unavailable" };
  }
}

export type AccessTokenResult =
  | { status: "token"; token: string }
  | { status: "signed-out" }
  | { status: "unavailable" };

/**
 * Returns the Cognito access token only. The ID token is never read.
 */
export async function currentAccessToken(): Promise<AccessTokenResult> {
  ensureConfigured();
  try {
    const session = await fetchAuthSession();
    const accessToken = session.tokens?.accessToken;
    const token = accessToken?.toString() ?? "";
    if (!token) return { status: "signed-out" };
    return { status: "token", token };
  } catch (error) {
    if (isDefinitiveAuthFailure(error)) return { status: "signed-out" };
    return { status: "unavailable" };
  }
}

/**
 * One shared read for every caller in this tab.
 *
 * @aws-amplify/auth 6.21.2 already wraps GetTokensFromRefreshToken in one
 * in-flight promise and writes the rotated refresh token before returning.
 * This lock stops the page from starting a second fetchAuthSession while
 * that read is still open. A definitive authentication failure is not read
 * again until the next explicit sign-in. A transient failure is not retried
 * inside this call.
 */
export function restoreSession(): Promise<SessionStatus> {
  if (refreshBlocked) {
    return Promise.resolve({ status: "signed-out" });
  }
  if (!sessionFlight) {
    const flight = readSession().finally(() => {
      if (sessionFlight === flight) sessionFlight = null;
    });
    sessionFlight = flight;
  }
  return sessionFlight;
}

function mapSignIn(result: SignInOutput): SignInStatus {
  const step = result.nextStep.signInStep;

  if (AUTHENTICATOR_STEPS.has(step)) {
    throw new AuthFlowError(AUTHENTICATOR_NOT_USED);
  }

  if (step === "RESET_PASSWORD") {
    return { status: "reset-password" };
  }

  if (step === "DONE" && result.isSignedIn) {
    return { status: "signed-in" };
  }

  throw new AuthFlowError(SIGN_IN_ERROR);
}

async function startSrpSignIn(email: string, password: string) {
  return signIn({
    username: email.trim(),
    password,
    options: { authFlowType: "USER_SRP_AUTH" },
  });
}

async function completeSignIn(result: SignInOutput): Promise<SignInStatus> {
  const mapped = mapSignIn(result);
  if (mapped.status !== "signed-in") return mapped;
  const session = await readSession();
  if (session.status === "unavailable") {
    throw new AuthFlowError(SESSION_UNAVAILABLE);
  }
  return session;
}

/**
 * Amplify refuses a second sign-in while a stored session can still produce
 * a user. Keep that refresh token and use it. Start a new sign-in only when
 * the stored session is actually gone, and only once.
 */
async function recoverExistingSession(
  email: string,
  password: string,
): Promise<SignInStatus> {
  const existing = await restoreSession();
  if (existing.status === "signed-in" || existing.status === "unapproved") {
    return existing;
  }
  if (existing.status === "unavailable") {
    throw new AuthFlowError(SESSION_UNAVAILABLE);
  }
  try {
    return await completeSignIn(await startSrpSignIn(email, password));
  } catch (error) {
    if (error instanceof AuthConfigError || error instanceof AuthFlowError) {
      throw error;
    }
    if (isAlreadyAuthenticated(error)) {
      throw new AuthFlowError(SESSION_UNAVAILABLE);
    }
    throw new AuthFlowError(SIGN_IN_ERROR);
  }
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<SignInStatus> {
  ensureConfigured();
  refreshBlocked = false;
  try {
    return await completeSignIn(await startSrpSignIn(email, password));
  } catch (error) {
    if (error instanceof AuthConfigError || error instanceof AuthFlowError) {
      throw error;
    }
    if (isAlreadyAuthenticated(error)) {
      return recoverExistingSession(email, password);
    }
    throw new AuthFlowError(SIGN_IN_ERROR);
  }
}

export const PASSWORD_POLICY_MESSAGE =
  "Use at least 8 characters, with an upper-case letter, a lower-case letter, a number, and a symbol.";

const EMAIL_MESSAGE = "Enter a valid email address.";
const PASSWORD_MISMATCH = "The passwords do not match.";
const ACCOUNT_EXISTS =
  "An account with this email already exists. Sign in or reset the password.";
const SIGN_UP_ERROR = "The account could not be created. Check the details and try again.";
const SIGN_UP_NETWORK =
  "The registration service could not be reached. Try again.";
const CONFIRM_ERROR = "That confirmation code was not accepted.";
const CONFIRM_NETWORK =
  "The confirmation service could not be reached. Try again.";

export function passwordMeetsPolicy(password: string) {
  return (
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isNetworkError(error: unknown) {
  return errorName(error) === "NetworkError" || error instanceof TypeError;
}

export type RegistrationResult =
  | { status: "confirm"; destination?: string }
  | { status: "complete" };

/**
 * Public self-registration. Cognito creates an ordinary user.
 * Group membership is not set here and cannot be chosen on this form.
 */
export async function registerAccount(
  email: string,
  password: string,
  confirmPassword: string,
): Promise<RegistrationResult> {
  ensureConfigured();
  const username = email.trim();
  if (!isValidEmail(username)) {
    throw new AuthFlowError(EMAIL_MESSAGE);
  }
  if (password !== confirmPassword) {
    throw new AuthFlowError(PASSWORD_MISMATCH);
  }
  if (!passwordMeetsPolicy(password)) {
    throw new AuthFlowError(PASSWORD_POLICY_MESSAGE);
  }
  try {
    const result = await signUp({
      username,
      password,
      options: {
        userAttributes: {
          email: username,
        },
      },
    });
    if (result.nextStep.signUpStep === "CONFIRM_SIGN_UP") {
      return {
        status: "confirm",
        destination: result.nextStep.codeDeliveryDetails?.destination,
      };
    }
    return { status: "complete" };
  } catch (error) {
    if (error instanceof AuthConfigError || error instanceof AuthFlowError) {
      throw error;
    }
    if (isNetworkError(error)) {
      throw new AuthFlowError(SIGN_UP_NETWORK);
    }
    const name = errorName(error);
    if (name === "UsernameExistsException" || name === "AliasExistsException") {
      throw new AuthFlowError(ACCOUNT_EXISTS);
    }
    if (name === "InvalidPasswordException" || name === "InvalidParameterException") {
      throw new AuthFlowError(PASSWORD_POLICY_MESSAGE);
    }
    throw new AuthFlowError(SIGN_UP_ERROR);
  }
}

export async function confirmRegistration(email: string, code: string) {
  ensureConfigured();
  const username = email.trim();
  const confirmationCode = code.trim();
  if (!isValidEmail(username)) {
    throw new AuthFlowError(EMAIL_MESSAGE);
  }
  if (!confirmationCode) {
    throw new AuthFlowError(CONFIRM_ERROR);
  }
  try {
    await confirmSignUp({ username, confirmationCode });
  } catch (error) {
    if (error instanceof AuthConfigError || error instanceof AuthFlowError) {
      throw error;
    }
    if (isNetworkError(error)) {
      throw new AuthFlowError(CONFIRM_NETWORK);
    }
    throw new AuthFlowError(CONFIRM_ERROR);
  }
}

export async function requestPasswordReset(email: string) {
  ensureConfigured();
  try {
    await resetPassword({ username: email.trim() });
  } catch (error) {
    if (error instanceof AuthConfigError) throw error;
    // The pool hides whether the account exists. The screen uses one message.
  }
}

export async function confirmPasswordReset(
  email: string,
  code: string,
  password: string,
) {
  ensureConfigured();
  if (!passwordMeetsPolicy(password)) {
    throw new AuthFlowError(RESET_ERROR);
  }
  try {
    await confirmResetPassword({
      username: email.trim(),
      confirmationCode: code.trim(),
      newPassword: password,
    });
  } catch (error) {
    if (error instanceof AuthConfigError || error instanceof AuthFlowError) {
      throw error;
    }
    throw new AuthFlowError(RESET_ERROR);
  }
}

export async function logOut() {
  refreshBlocked = true;
  try {
    if (isAuthConfigured()) {
      ensureConfigured();
      await signOut({ global: true });
    }
  } catch {
    // Local sign-in state is already cleared. A failed GlobalSignOut
    // must not be retried in a loop.
  }
}
