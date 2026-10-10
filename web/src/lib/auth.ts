"use client";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { api } from "./api";
import { getToken } from "./token";
import type { Role, User } from "./types";

export const homeFor = (role: Role) => (role === "brand" ? "/brand" : "/creator");

/** The logged-in user. Waits for the first client render so server and client markup match. */
export function useMe() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Mount gate: localStorage is read only after this, so server and client markup match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
  }, []);
  return useSWR<User>(ready && getToken() ? "/me" : null, api);
}
