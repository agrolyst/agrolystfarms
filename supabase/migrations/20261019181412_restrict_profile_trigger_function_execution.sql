-- The profile helper is used by the auth.users trigger only, never by a client RPC.
revoke all on function public.handle_new_user() from public, anon, authenticated;
