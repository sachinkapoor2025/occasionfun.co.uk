### 6.3.1 Tokens, rotation, and concurrency

Amplify stores the access token, ID token, and refresh token as one bundle in its Cognito token store. The installed `@aws-amplify/auth@6.21.2` refresher calls `GetTokensFromRefreshToken` and is wrapped in a single in-flight promise (`deDupeAsyncFunction` around `refreshAuthTokens`). The token orchestrator writes the replacement refresh token immediately after that call succeeds. A definitive authentication failure, including `RefreshTokenReuseException` and `NotAuthorizedException`, clears the stored tokens and does not retry.

The application points that same Amplify store at `sessionStorage`. It does not keep a second token store. Splitting the access token into a separate memory store would race Amplify’s writer, so the whole bundle stays in Amplify’s store for the browser tab. `sessionStorage` is readable by script in the page. A static export cannot set an `httpOnly` cookie.

The admin session helper also shares one in-flight `fetchAuthSession` promise. That promise is in memory for the current document. Amplify's single-flight refresh and this application lock both serialise refresh calls within one browser document. Neither mechanism coordinates a duplicated browser tab.

A definitive authentication failure, including `RefreshTokenReuseException` and `NotAuthorizedException`, marks that tab signed out. Later reads in that tab do not call Cognito again, so a render loop cannot rotate or retry the same refresh token. A transient failure, such as a network or throttling error, does not set that block. The next explicit read can try again. The rotation grace period is 0 seconds. Cognito invalidates the submitted refresh token as soon as one rotation succeeds.

Duplicating a Chrome or Edge tab can copy that tab's `sessionStorage` at the moment of duplication. The two tabs then have independent `sessionStorage` areas. A `storage` event does not carry later writes from one of those areas to the other. After the copied access token expires, both tabs may call `GetTokensFromRefreshToken` with the same refresh token. One refresh can succeed and keep the replacement refresh token. The other receives `RefreshTokenReuseException`. The losing tab must sign in again. The first tab may remain authenticated with its replacement refresh token.

Accepted limitation: the current `sessionStorage` design does not guarantee that duplicated tabs remain authenticated independently after access-token expiry.

The following are intentionally not implemented. Sharing a refresh token by any of these means would broaden access to that credential beyond the individual Admin tab:

- Refresh-token sharing through `BroadcastChannel`.
- Refresh-token sharing through `localStorage`.
- `SharedWorker` token coordination.
- A backend session service.
- Increasing Cognito's refresh-token grace period.
- Cross-tab token synchronisation.

Web Locks are not an implemented solution. A lock can queue work across tabs, but it cannot provide the replacement refresh token to another tab under this isolated `sessionStorage` design.

### 6.3.2 What the browser may decide

### 6.3.3 Sign-out

Sign-out calls Amplify `signOut({ global: true })`. Amplify asks Cognito to run `GlobalSignOut`, then clears the tokens stored for the current tab. A failed `GlobalSignOut` is caught inside Amplify. The JavaScript promise can still resolve, and the local tokens are still removed. A resolved Amplify sign-out promise is not evidence that Cognito revoked sessions on other devices.

Local sign-out is guaranteed by the application. Remote session revocation must not be claimed as guaranteed. Other devices may remain signed in. Access tokens already issued on those devices may remain usable until they expire. This design does not add a second, direct Cognito `GlobalSignOut` call. After sign-out, the screen says: "You are signed out on this device. Other devices may remain signed in."

### 6.4 What a protected Lambda checks
