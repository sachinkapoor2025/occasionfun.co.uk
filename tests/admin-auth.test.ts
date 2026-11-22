import { beforeEach, describe, expect, it, vi } from "vitest";

const configure = vi.hoisted(() => vi.fn());
const signIn = vi.hoisted(() => vi.fn());
const confirmSignIn = vi.hoisted(() => vi.fn());
const fetchAuthSession = vi.hoisted(() => vi.fn());
const resetPassword = vi.hoisted(() => vi.fn());
const confirmResetPassword = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() => vi.fn());
const signUp = vi.hoisted(() => vi.fn());
const confirmSignUp = vi.hoisted(() => vi.fn());
const setKeyValueStorage = vi.hoisted(() => vi.fn());

vi.mock("aws-amplify", () => ({
  Amplify: { configure },
}));

vi.mock("aws-amplify/auth", () => ({
  signIn,
  confirmSignIn,
  fetchAuthSession,
  resetPassword,
  confirmResetPassword,
  signOut,
  signUp,
  confirmSignUp,
}));

vi.mock("aws-amplify/auth/cognito", () => ({
  cognitoUserPoolsTokenProvider: { setKeyValueStorage },
}));

function namedError(name: string, message: string) {
  return Object.assign(new Error(message), { name });
}

function adminSession(groups: string[]) {
  return {
    tokens: {
      accessToken: {
        payload: { "cognito:groups": groups },
        toString() {
          return "access-token";
        },
      },
    },
  };
}

async function loadAuth() {
  vi.resetModules();
  return import("../src/lib/admin/auth");
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_COGNITO_REGION = "eu-west-2";
  process.env.NEXT_PUBLIC_COGNITO_POOL_ID = "eu-west-2_demo";
  process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID = "client";
});

describe("admin authentication", () => {
  it("completes SRP sign-in for an approved administrator", async () => {
    signIn.mockResolvedValue({
      isSignedIn: true,
      nextStep: { signInStep: "DONE" },
    });
    fetchAuthSession.mockResolvedValue(adminSession(["admin"]));
    const auth = await loadAuth();

    await expect(
      auth.signInWithPassword("ada@example.com", "Correct-horse-1"),
    ).resolves.toEqual({ status: "signed-in" });

    expect(signIn).toHaveBeenCalledWith({
      username: "ada@example.com",
      password: "Correct-horse-1",
      options: { authFlowType: "USER_SRP_AUTH" },
    });
    expect(configure).toHaveBeenCalledWith({
      Auth: {
        Cognito: {
          userPoolId: "eu-west-2_demo",
          userPoolClientId: "client",
        },
      },
    });
  });

  it("uses a generic message when SRP sign-in fails", async () => {
    signIn.mockRejectedValue(new Error("User does not exist."));
    const auth = await loadAuth();

    await expect(
      auth.signInWithPassword("ada@example.com", "wrong-password"),
    ).rejects.toThrow(
      "The email or password is incorrect, or this account cannot sign in.",
    );
  });

  it("completes email and password sign-in without an authenticator step", async () => {
    signIn.mockResolvedValue({
      isSignedIn: true,
      nextStep: { signInStep: "DONE" },
    });
    fetchAuthSession.mockResolvedValue(adminSession(["admin"]));
    const auth = await loadAuth();

    await expect(
      auth.signInWithPassword("ada@example.com", "Correct-horse-1"),
    ).resolves.toEqual({ status: "signed-in" });
    expect(confirmSignIn).not.toHaveBeenCalled();
    expect(signIn).toHaveBeenCalledWith({
      username: "ada@example.com",
      password: "Correct-horse-1",
      options: { authFlowType: "USER_SRP_AUTH" },
    });
  });

  it("does not start an authenticator challenge or setup", async () => {
    signIn.mockResolvedValue({
      isSignedIn: false,
      nextStep: { signInStep: "CONFIRM_SIGN_IN_WITH_TOTP_CODE" },
    });
    const auth = await loadAuth();

    await expect(
      auth.signInWithPassword("ada@example.com", "Correct-horse-1"),
    ).rejects.toThrow("Authenticator verification is not used.");
    expect(confirmSignIn).not.toHaveBeenCalled();

    signIn.mockResolvedValue({
      isSignedIn: false,
      nextStep: { signInStep: "CONTINUE_SIGN_IN_WITH_TOTP_SETUP" },
    });
    await expect(
      auth.signInWithPassword("ada@example.com", "Correct-horse-1"),
    ).rejects.toThrow("Authenticator verification is not used.");
    expect(confirmSignIn).not.toHaveBeenCalled();
  });

  it("requests and confirms a password reset without revealing the account", async () => {
    resetPassword.mockRejectedValue(new Error("User does not exist."));
    confirmResetPassword.mockResolvedValue(undefined);
    const auth = await loadAuth();

    await expect(
      auth.requestPasswordReset("ada@example.com"),
    ).resolves.toBeUndefined();
    expect(resetPassword).toHaveBeenCalledWith({ username: "ada@example.com" });

    await auth.confirmPasswordReset(
      "ada@example.com",
      "123456",
      "Correct-horse-1!",
    );
    expect(confirmResetPassword).toHaveBeenCalledWith({
      username: "ada@example.com",
      confirmationCode: "123456",
      newPassword: "Correct-horse-1!",
    });
  });

  it("shares one session read across concurrent callers", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    fetchAuthSession.mockImplementation(async () => {
      calls += 1;
      await gate;
      return adminSession(["admin"]);
    });
    const auth = await loadAuth();

    const first = auth.restoreSession();
    const second = auth.restoreSession();
    expect(calls).toBe(1);
    release();
    await expect(first).resolves.toEqual({ status: "signed-in" });
    await expect(second).resolves.toEqual({ status: "signed-in" });
    expect(fetchAuthSession).toHaveBeenCalledTimes(1);
  });

  it("does not retry an expired session", async () => {
    fetchAuthSession.mockResolvedValue({ tokens: undefined });
    const auth = await loadAuth();

    await expect(auth.restoreSession()).resolves.toEqual({
      status: "signed-out",
    });
    await expect(auth.restoreSession()).resolves.toEqual({
      status: "signed-out",
    });
    expect(fetchAuthSession).toHaveBeenCalledTimes(1);
  });

  it("signs out with GlobalSignOut", async () => {
    signOut.mockResolvedValue(undefined);
    const auth = await loadAuth();

    await auth.logOut();
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith({ global: true });
    await expect(auth.restoreSession()).resolves.toEqual({
      status: "signed-out",
    });
  });

  it("retries session restoration after a temporary network failure", async () => {
    fetchAuthSession
      .mockRejectedValueOnce(namedError("NetworkError", "A network error has occurred."))
      .mockResolvedValueOnce(adminSession(["admin"]));
    const auth = await loadAuth();

    await expect(auth.restoreSession()).resolves.toEqual({
      status: "unavailable",
    });
    expect(fetchAuthSession).toHaveBeenCalledTimes(1);
    expect(signOut).not.toHaveBeenCalled();

    await expect(auth.restoreSession()).resolves.toEqual({
      status: "signed-in",
    });
    expect(fetchAuthSession).toHaveBeenCalledTimes(2);
  });

  it("does not clear the session after a throttling or service error", async () => {
    fetchAuthSession
      .mockRejectedValueOnce(
        namedError("TooManyRequestsException", "Rate exceeded"),
      )
      .mockRejectedValueOnce(
        namedError("InternalErrorException", "Service unavailable"),
      )
      .mockResolvedValueOnce(adminSession(["admin"]));
    const auth = await loadAuth();

    await expect(auth.restoreSession()).resolves.toEqual({
      status: "unavailable",
    });
    await expect(auth.restoreSession()).resolves.toEqual({
      status: "unavailable",
    });
    await expect(auth.restoreSession()).resolves.toEqual({
      status: "signed-in",
    });
    expect(signOut).not.toHaveBeenCalled();
    expect(fetchAuthSession).toHaveBeenCalledTimes(3);
  });

  it("signs out after a reused refresh token and does not retry", async () => {
    fetchAuthSession.mockRejectedValue(
      namedError("RefreshTokenReuseException", "Refresh token reused"),
    );
    const auth = await loadAuth();

    await expect(auth.restoreSession()).resolves.toEqual({
      status: "signed-out",
    });
    await expect(auth.restoreSession()).resolves.toEqual({
      status: "signed-out",
    });
    expect(fetchAuthSession).toHaveBeenCalledTimes(1);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("restores an existing session when sign-in reports the user is already authenticated", async () => {
    signIn.mockRejectedValue(
      namedError(
        "UserAlreadyAuthenticatedException",
        "There is already a signed in user.",
      ),
    );
    fetchAuthSession.mockResolvedValue(adminSession(["admin"]));
    const auth = await loadAuth();

    await expect(
      auth.signInWithPassword("ada@example.com", "Correct-horse-1"),
    ).resolves.toEqual({ status: "signed-in" });
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("starts one new sign-in when the stored session is already gone", async () => {
    signIn
      .mockRejectedValueOnce(
        namedError(
          "UserAlreadyAuthenticatedException",
          "There is already a signed in user.",
        ),
      )
      .mockResolvedValueOnce({
        isSignedIn: true,
        nextStep: { signInStep: "DONE" },
      });
    fetchAuthSession
      .mockResolvedValueOnce({ tokens: undefined })
      .mockResolvedValue(adminSession(["admin"]));
    const auth = await loadAuth();

    await expect(
      auth.signInWithPassword("ada@example.com", "Correct-horse-1"),
    ).resolves.toEqual({ status: "signed-in" });
    await expect(auth.restoreSession()).resolves.toEqual({
      status: "signed-in",
    });
    expect(signIn).toHaveBeenCalledTimes(2);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("does not loop when an existing session cannot be replaced", async () => {
    signIn.mockRejectedValue(
      namedError(
        "UserAlreadyAuthenticatedException",
        "There is already a signed in user.",
      ),
    );
    fetchAuthSession.mockResolvedValue({ tokens: undefined });
    const auth = await loadAuth();

    await expect(
      auth.signInWithPassword("ada@example.com", "Correct-horse-1"),
    ).rejects.toThrow("The existing session could not be checked. Try again.");
    expect(signIn).toHaveBeenCalledTimes(2);
    expect(fetchAuthSession).toHaveBeenCalledTimes(1);
  });

  it("returns the access token and does not read the ID token", async () => {
    const idToken = vi.fn(() => "id-token");
    fetchAuthSession.mockResolvedValue({
      tokens: {
        accessToken: {
          payload: { "cognito:groups": ["admin"] },
          toString: () => "access-token",
        },
        idToken: { toString: idToken },
      },
    });
    const auth = await loadAuth();

    await expect(auth.currentAccessToken()).resolves.toEqual({
      status: "token",
      token: "access-token",
    });
    expect(idToken).not.toHaveBeenCalled();
  });

  it("treats a missing access token as signed out", async () => {
    fetchAuthSession.mockResolvedValue({
      tokens: { idToken: { toString: () => "id-token" } },
    });
    const auth = await loadAuth();

    await expect(auth.currentAccessToken()).resolves.toEqual({
      status: "signed-out",
    });
  });

  it("registers through Cognito signUp without assigning the admin group", async () => {
    signUp.mockResolvedValue({
      isSignUpComplete: false,
      nextStep: {
        signUpStep: "CONFIRM_SIGN_UP",
        codeDeliveryDetails: { destination: "a***@example.com" },
      },
    });
    const auth = await loadAuth();

    await expect(
      auth.registerAccount(
        "ada@example.com",
        "Correct-horse-1!",
        "Correct-horse-1!",
      ),
    ).resolves.toEqual({
      status: "confirm",
      destination: "a***@example.com",
    });

    expect(signUp).toHaveBeenCalledTimes(1);
    const payload = signUp.mock.calls[0][0];
    expect(payload).toEqual({
      username: "ada@example.com",
      password: "Correct-horse-1!",
      options: {
        userAttributes: { email: "ada@example.com" },
      },
    });
    expect(JSON.stringify(payload)).not.toMatch(/cognito:groups|admin/i);
    expect(signIn).not.toHaveBeenCalled();
  });

  it("accepts an 8-character password that meets every character rule", async () => {
    signUp.mockResolvedValue({
      isSignUpComplete: false,
      nextStep: { signUpStep: "CONFIRM_SIGN_UP" },
    });
    confirmResetPassword.mockResolvedValue(undefined);
    const auth = await loadAuth();

    expect(auth.passwordMeetsPolicy("Abcdef1!")).toBe(true);
    await expect(
      auth.registerAccount("ada@example.com", "Abcdef1!", "Abcdef1!"),
    ).resolves.toEqual({ status: "confirm" });
    expect(signUp).toHaveBeenCalledWith({
      username: "ada@example.com",
      password: "Abcdef1!",
      options: { userAttributes: { email: "ada@example.com" } },
    });

    await auth.confirmPasswordReset("ada@example.com", "123456", "Abcdef1!");
    expect(confirmResetPassword).toHaveBeenCalledWith({
      username: "ada@example.com",
      confirmationCode: "123456",
      newPassword: "Abcdef1!",
    });
  });

  it("rejects passwords that miss the 8-character policy before calling Cognito", async () => {
    const auth = await loadAuth();
    const rejected = ["Abcde1!", "abcdef1!", "ABCDEF1!", "Abcdefg!", "Abcdefg1"];

    for (const password of rejected) {
      expect(auth.passwordMeetsPolicy(password)).toBe(false);
      await expect(
        auth.registerAccount("ada@example.com", password, password),
      ).rejects.toThrow(
        "Use at least 8 characters, with an upper-case letter, a lower-case letter, a number, and a symbol.",
      );
      await expect(
        auth.confirmPasswordReset("ada@example.com", "123456", password),
      ).rejects.toThrow(
        "That code is not valid, or the new password does not meet the password policy.",
      );
    }
    expect(signUp).not.toHaveBeenCalled();
    expect(confirmResetPassword).not.toHaveBeenCalled();
  });

  it("rejects a mismatched password before calling Cognito", async () => {
    const auth = await loadAuth();

    await expect(
      auth.registerAccount("ada@example.com", "Correct-horse-1!", "Other-horse-1!"),
    ).rejects.toThrow("The passwords do not match.");
    expect(signUp).not.toHaveBeenCalled();
  });

  it("reports a network failure without an authorisation error", async () => {
    signUp.mockRejectedValue(new TypeError("Failed to fetch"));
    const auth = await loadAuth();

    await expect(
      auth.registerAccount(
        "ada@example.com",
        "Correct-horse-1!",
        "Correct-horse-1!",
      ),
    ).rejects.toThrow("The registration service could not be reached. Try again.");
  });

  it("reports an existing account without creating another one", async () => {
    signUp.mockRejectedValue(namedError("UsernameExistsException", "exists"));
    const auth = await loadAuth();

    await expect(
      auth.registerAccount(
        "ada@example.com",
        "Correct-horse-1!",
        "Correct-horse-1!",
      ),
    ).rejects.toThrow("An account with this email already exists.");
  });

  it("confirms the email code and does not sign the user in", async () => {
    confirmSignUp.mockResolvedValue({ isSignUpComplete: true });
    const auth = await loadAuth();

    await expect(
      auth.confirmRegistration("ada@example.com", "123456"),
    ).resolves.toBeUndefined();
    expect(confirmSignUp).toHaveBeenCalledWith({
      username: "ada@example.com",
      confirmationCode: "123456",
    });
    expect(signIn).not.toHaveBeenCalled();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("treats a verified user outside the admin group as unapproved", async () => {
    signIn.mockResolvedValue({
      isSignedIn: true,
      nextStep: { signInStep: "DONE" },
    });
    fetchAuthSession.mockResolvedValue(adminSession(["visitors"]));
    const auth = await loadAuth();

    await expect(
      auth.signInWithPassword("ada@example.com", "Correct-horse-1"),
    ).resolves.toEqual({ status: "unapproved" });
  });
});
