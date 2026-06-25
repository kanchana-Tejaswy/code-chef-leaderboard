-- 1. Create a function to handle new auth.users inserts
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert into public.users, matching ID and parsing metadata role
  INSERT INTO public.users (id, email, role, created_at, updated_at)
  VALUES (
    new.id,
    new.email,
    COALESCE(
      -- Parse role from user metadata (supplied on signup options)
      (new.raw_user_meta_data->>'role')::public."Role",
      'STUDENT'::public."Role"
    ),
    COALESCE(new.created_at, now()),
    COALESCE(new.created_at, now())
  )
  -- If user already exists (e.g. seeded), ignore insert
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger on the auth.users table
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
