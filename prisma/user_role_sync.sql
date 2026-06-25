-- 1. Create a function to sync role changes from public.users back to auth.users raw user metadata
CREATE OR REPLACE FUNCTION public.handle_user_role_update()
RETURNS trigger AS $$
BEGIN
  -- Merge the new role value into raw_user_meta_data JSON structure
  UPDATE auth.users
  SET raw_user_meta_data = 
    COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', NEW.role::text)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger on public.users to execute after role updates
DROP TRIGGER IF EXISTS on_user_role_updated ON public.users;
CREATE TRIGGER on_user_role_updated
  AFTER UPDATE OF role ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_role_update();
