import { ConvexClient } from "convex/browser";
import { ref, watchEffect, unref, type Ref } from "vue";
import type { FunctionReference, FunctionArgs, FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";

export let convex: ConvexClient;

export function initConvex(url: string) {
  if (!convex) {
    convex = new ConvexClient(url);
  }
  return convex;
}

export function useQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args?: FunctionArgs<Query> | Ref<FunctionArgs<Query>> | (() => FunctionArgs<Query>)
) {
  const data = ref<Query["_returnType"] | undefined>(undefined);
  const error = ref<Error | null>(null);

  watchEffect((onCleanup) => {
    if (!convex) {
      if (typeof window !== 'undefined') {
        console.warn("useQuery called before initConvex");
      }
      return;
    }

    // Resolve the reactive arguments
    let currentArgs: FunctionArgs<Query>;
    if (typeof args === 'function') {
      currentArgs = (args as () => FunctionArgs<Query>)();
    } else {
      currentArgs = unref(args) as FunctionArgs<Query>;
    }
    
    // We default to {} if undefined, as Convex often expects an object
    const finalArgs = currentArgs ?? ({} as FunctionArgs<Query>);

    const unsubscribe = convex.onUpdate(
      query,
      finalArgs,
      (newData) => {
        data.value = newData;
        error.value = null;
      },
      (err) => {
        error.value = err;
      }
    );

    onCleanup(() => unsubscribe());
  });

  return { data, error };
}

export function useMutation<Mutation extends FunctionReference<"mutation">>(
  mutation: Mutation
) {
  return async (
    args?: FunctionArgs<Mutation>
  ): Promise<FunctionReturnType<Mutation>> => {
    if (!convex) throw new Error("useMutation called before initConvex");
    return await convex.mutation(mutation, args);
  };
}

export function useAction<Action extends FunctionReference<"action">>(
  action: Action
) {
  return async (
    args?: FunctionArgs<Action>
  ): Promise<FunctionReturnType<Action>> => {
    if (!convex) throw new Error("useAction called before initConvex");
    return await convex.action(action, args);
  };
}


/**
 * Extracts a user-facing error string from a Convex call.
 * Priority: ConvexError.data -> ConvexError.message / Error.message -> default fallback error message.
 */
export function parseConvexError(
  err: unknown,
  defaultMsg: string = "An unexpected error occurred."
): string {
  if (err instanceof ConvexError) {
    if (typeof err.data === "string" && err.data.trim().length > 0) {
      return err.data;
    }
    if (
      err.data &&
      typeof err.data === "object" &&
      "message" in err.data &&
      typeof (err.data as { message?: unknown }).message === "string" &&
      (err.data as { message: string }).message.trim().length > 0
    ) {
      return (err.data as { message: string }).message;
    }
    if (err.message && err.message.trim().length > 0) {
      return err.message;
    }
  }
  if (err instanceof Error && err.message && err.message.trim().length > 0) {
    return err.message;
  }
  return defaultMsg;
}
