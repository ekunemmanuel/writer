import { ref, computed } from 'vue';
import { ConvexHttpClient } from 'convex/browser';
import { convex } from './useConvex';
import { api } from '@convex/_generated/api';

export let authClient: ConvexHttpClient;

export function initAuth(url: string) {
  if (!authClient) {
    authClient = new ConvexHttpClient(url);
  }
}

const CONVEX_AUTH_JWT_KEY = '__convexAuthJWT';
const CONVEX_AUTH_REFRESH_KEY = '__convexAuthRefreshToken';

const isLoading = ref(true);
const accessToken = ref<string | null>(null);
export const isAuthenticated = computed(() => !!accessToken.value);

function isTokenExpired(token: string | null) {
  if (!token) return true;
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return true;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join(""),
    );
    const payload = JSON.parse(jsonPayload);
    // Add 10 seconds buffer
    return payload.exp * 1000 < Date.now() + 10000;
  } catch (e) {
    return true;
  }
}

async function setTokens(token: string | null, newRefreshToken: string | null) {
  if (token) {
    localStorage.setItem(CONVEX_AUTH_JWT_KEY, token);
    accessToken.value = token;
    convex.setAuth(fetchAccessToken);
  } else {
    localStorage.removeItem(CONVEX_AUTH_JWT_KEY);
    accessToken.value = null;
    convex.setAuth(async () => null);
  }

  if (newRefreshToken) {
    localStorage.setItem(CONVEX_AUTH_REFRESH_KEY, newRefreshToken);
  } else {
    localStorage.removeItem(CONVEX_AUTH_REFRESH_KEY);
  }
}

export async function fetchAccessToken() {
  if (!authClient) throw new Error("fetchAccessToken called before initAuth");

  let token = accessToken.value || localStorage.getItem(CONVEX_AUTH_JWT_KEY);
  const refreshToken = localStorage.getItem(CONVEX_AUTH_REFRESH_KEY);

  if (isTokenExpired(token) && refreshToken) {
    // Attempt silent refresh
    try {
      const result = await authClient.action(
        api.auth.signIn,
        { refreshToken }
      );

      if (result && result.tokens) {
        await setTokens(result.tokens.token, result.tokens.refreshToken);
        token = result.tokens.token;
      } else {
        await setTokens(null, null);
        token = null;
      }
    } catch (e) {
      await setTokens(null, null);
      token = null;
    }
  }

  // Update reactive ref if we found a token in storage but it wasn't in the ref
  if (token && !accessToken.value) {
    accessToken.value = token;
  }

  return token;
}

// Ensure auth reactivity runs in browser environments
if (typeof window !== 'undefined') {
  const initialToken = localStorage.getItem(CONVEX_AUTH_JWT_KEY);
  accessToken.value = initialToken;
  isLoading.value = false;

  window.addEventListener('storage', (event: StorageEvent) => {
    if (event.key === CONVEX_AUTH_JWT_KEY) {
      accessToken.value = event.newValue;
      if (event.newValue) {
        if (convex) convex.setAuth(fetchAccessToken);
      } else {
        if (convex) convex.setAuth(async () => null);
      }
    }
  });
} else {
  isLoading.value = false;
}

export function useAuth() {
  const signIn = async (email: string, password: string, isSignUp = false) => {
    if (!authClient) throw new Error("signIn called before initAuth");
    isLoading.value = true;
    try {
      const flow = isSignUp ? 'signUp' : 'signIn';

      const result = await authClient.action(api.auth.signIn, {
        provider: 'password',
        params: { email, password, flow }
      });

      if (result && result.redirect) {
        window.location.href = result.redirect;
      } else if (result && result.tokens) {
        await setTokens(result.tokens.token, result.tokens.refreshToken);
      }
    } catch (e) {
      console.error(e);
      throw e;
    } finally {
      isLoading.value = false;
    }
  };

  const signOut = async () => {
    if (!convex) throw new Error("signOut called before initConvex");
    isLoading.value = true;
    try {
      await convex.action(api.auth.signOut, {});
    } catch (e) {
      console.error("Sign out error", e);
    } finally {
      await setTokens(null, null);
      isLoading.value = false;
    }
  };

  return {
    isAuthenticated,
    isLoading,
    signIn,
    signOut
  };
}
